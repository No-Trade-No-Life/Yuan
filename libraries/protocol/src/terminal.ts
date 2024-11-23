import { UUID, formatTime } from '@yuants/data-model';
import {
  NativeSubject,
  observableToAsyncIterable,
  rateLimitMap,
  subjectToNativeSubject,
} from '@yuants/utils';
import Ajv, { ValidateFunction } from 'ajv';
import { isNode } from 'browser-or-node';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  ObservableInput,
  ReplaySubject,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  first,
  firstValueFrom,
  from,
  fromEvent,
  groupBy,
  interval,
  map,
  mergeAll,
  mergeMap,
  mergeWith,
  of,
  partition,
  repeat,
  retry,
  share,
  shareReplay,
  switchMap,
  takeWhile,
  tap,
  timeout,
  timer,
  toArray,
  withLatestFrom,
} from 'rxjs';
import type SimplePeer from 'simple-peer';
import { IConnection, createConnectionWs } from './create-connection';
import { ITerminalInfo } from './model';
import { IService, ITerminalMessage } from './services';
import { PromRegistry } from './services/metrics';
import { getSimplePeerInstance } from './webrtc';

const TerminalReceivedBytesTotal = PromRegistry.create('counter', 'terminal_received_bytes_total');
const TerminalTransmittedBytesTotal = PromRegistry.create('counter', 'terminal_transmitted_bytes_total');
const TerminalReceiveMassageTotal = PromRegistry.create('counter', 'terminal_receive_message_total');
const TerminalTransmittedMessageTotal = PromRegistry.create('counter', 'terminal_transmitted_message_total');

const TerminalReceiveChannelMassageTotal = PromRegistry.create(
  'counter',
  'terminal_received_channel_message_total',
);
const TerminalTransmittedChannelMessageTotal = PromRegistry.create(
  'counter',
  'terminal_transmitted_channel_message_total',
);

const RequestDurationBucket = PromRegistry.create(
  'histogram',
  'terminal_request_duration_milliseconds',
  'terminal_request_duration_milliseconds Request Duration bucket in 1, 10, 100, 1000, 10000 ms',
  [1, 10, 100, 1000, 10000],
);

const RequestReceivedTotal = PromRegistry.create(
  'counter',
  'terminal_request_received_total',
  'terminal_request_received_total Terminal request received',
);

type IServiceHandler<T extends string = string> = T extends keyof IService
  ? (
      msg: ITerminalMessage & Pick<IService[T], 'req'> & { method: T },
      output$: NativeSubject<
        Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'> &
          Partial<Pick<IService[T], 'res' | 'frame'>>
      >,
    ) => ObservableInput<
      Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'> &
        Partial<Pick<IService[T], 'res' | 'frame'>>
    >
  : // ISSUE: Allow custom methods between terminals
    (
      msg: ITerminalMessage,
      output$: NativeSubject<
        Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'>
      >,
    ) => ObservableInput<
      Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'>
    >;

interface IServiceOptions {
  concurrent?: number;
  rateLimitConfig?: {
    count: number;
    period: number;
  };
}

const MetricsProcessMemoryUsage = PromRegistry.create(
  'gauge',
  'nodejs_process_memory_usage',
  'nodejs process memoryUsage',
);

const MetricsProcessResourceUsage = PromRegistry.create(
  'gauge',
  'nodejs_process_resource_usage',
  'nodejs process resourceUsage',
);

/**
 * Terminal
 *
 * @public
 */
export class Terminal {
  /**
   * Connection
   */
  private _conn: IConnection<string>;
  /**
   * Terminal ID
   */
  terminal_id: string;
  private _serviceHandlers: Record<string, IServiceHandler> = {};
  private _serviceOptions: Record<string, IServiceOptions> = {};

  private _terminalInfoUpdated$ = new Subject<void>();

  constructor(public host_url: string, public terminalInfo: ITerminalInfo, connection?: IConnection<string>) {
    this.terminal_id = this.terminalInfo.terminal_id || UUID();
    this.terminalInfo = {
      ...terminalInfo,
      terminal_id: this.terminal_id,
      serviceInfo: {},
      channelIdSchemas: [],
    };

    const url = new URL(host_url);
    url.searchParams.set('terminal_id', this.terminal_id); // make sure terminal_id is in the connection parameters
    this.host_url = url.toString();

    this._conn = connection || createConnectionWs(this.host_url);
    this._setupTunnel();
    this._setupDebugLog();
    this._setupServer();
    this._setupPredefinedServerHandlers();
    this._setupChannelValidatorSubscription();
    this._setupTerminalIdAndMethodValidatorSubscription();

    this.terminalInfo.created_at = Date.now();
    this.terminalInfo.status ??= 'INIT';

    this._setupTerminalInfoStuff();
  }

  private _mapTerminalIdToPeer: Record<
    string,
    { session_id: string; maxMessageSize: number; peer: SimplePeer.Instance } | undefined
  > = {};

  private _setupTunnel() {
    this._subscriptions.push(
      from(this._conn.input$)
        .pipe(
          map((msg) => msg.toString()),
          tap((msg) => {
            TerminalReceivedBytesTotal.add(msg.length, {
              terminal_id: this.terminal_id,
              tunnel: 'WS',
            });
          }),
          map((msg): ITerminalMessage => JSON.parse(msg)),
        )
        .subscribe((msg) => {
          if (msg.method) {
            TerminalReceiveMassageTotal.inc({
              target_terminal_id: msg.target_terminal_id,
              source_terminal_id: msg.source_terminal_id,
              tunnel: 'WS',
              method: msg.method,
            });
          }
          if (msg.channel_id) {
            TerminalReceiveChannelMassageTotal.inc({
              target_terminal_id: msg.target_terminal_id,
              source_terminal_id: msg.source_terminal_id,
              tunnel: 'WS',
              channel_id: msg.channel_id,
            });
          }
          this._input$.next(msg);
        }),
    );

    if (this.terminalInfo.enable_WebRTC) {
      this._setupWebRTCTunnel();
    }

    this._subscriptions.push(
      this._output$.subscribe((msg) => {
        // Local Loop Back Tunnel
        if (msg.target_terminal_id === this.terminal_id) {
          // ISSUE: Avoid infinite loop, so we should delay the loopback message
          setTimeout(() => this._input$.next(msg));
          return;
        }

        // WebRTC Tunnel
        const peerInfo = this._mapTerminalIdToPeer[msg.target_terminal_id];
        if (msg.method) {
          TerminalTransmittedMessageTotal.inc({
            target_terminal_id: msg.target_terminal_id,
            source_terminal_id: msg.source_terminal_id,
            tunnel: peerInfo !== undefined && peerInfo.peer.connected ? 'WebRTC' : 'WS',
            method: msg.method,
          });
        }
        if (msg.channel_id) {
          TerminalTransmittedChannelMessageTotal.inc({
            target_terminal_id: msg.target_terminal_id,
            source_terminal_id: msg.source_terminal_id,
            tunnel: peerInfo !== undefined && peerInfo.peer.connected ? 'WebRTC' : 'WS',
            channel_id: msg.channel_id,
          });
        }
        // NOTE: reserve 32KB for other purpose
        const reservedSize = 32 * 1024;
        if (peerInfo && peerInfo.peer.connected && (peerInfo.maxMessageSize ?? 0) > reservedSize) {
          const stringified = JSON.stringify(msg);
          setTimeout(() => {
            try {
              const trace_id = UUID();
              const chunkSize = peerInfo.maxMessageSize - reservedSize;
              if (stringified.length > chunkSize) {
                for (let i = 0; i < stringified.length; i += chunkSize) {
                  const body = stringified.slice(i, i + chunkSize);
                  if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
                    console.info(
                      formatTime(Date.now()),
                      'Terminal',
                      'WebRTC',
                      'sent',
                      `chunkSize: ${chunkSize}`,
                      body.length,
                    );
                  }
                  peerInfo.peer.send(
                    JSON.stringify({
                      trace_id,
                      method: `WebRTC/Chunk`,
                      source_terminal_id: msg.source_terminal_id,
                      target_terminal_id: msg.target_terminal_id,
                      frame: {
                        seq: i / chunkSize,
                        body,
                      },
                    }),
                  );
                }
                peerInfo.peer.send(
                  JSON.stringify({
                    trace_id,
                    method: `WebRTC/Chunk`,
                    source_terminal_id: msg.source_terminal_id,
                    target_terminal_id: msg.target_terminal_id,
                    res: { code: 200, message: 'OK' },
                  }),
                );
              } else {
                peerInfo.peer.send(stringified);
              }
            } catch (err) {
              console.error(formatTime(Date.now()), 'Terminal', 'WebRTC', 'send', 'error', err);
              // fall back to WS
              const content = JSON.stringify(msg);
              TerminalTransmittedBytesTotal.add(content.length, {
                terminal_id: this.terminal_id,
                tunnel: 'WS',
              });

              this._conn.output$.next(content);
            }
          });
          return;
        }

        const content = JSON.stringify(msg);
        TerminalTransmittedBytesTotal.add(content.length, {
          terminal_id: this.terminal_id,
          tunnel: 'WS',
        });

        this._conn.output$.next(content);
      }),
    );
  }

  private _setupPeer(config: {
    session_id: string;
    direction: 'Active' | 'Passive';
    remote_terminal_id: string;
    onSignal: (data: any) => Observable<unknown>;
    onDestroy: () => void;
  }) {
    const { session_id, direction, remote_terminal_id, onSignal, onDestroy } = config;
    const subs: Subscription[] = [];
    const peer = getSimplePeerInstance({
      initiator: direction === 'Active',
      channelName:
        direction === 'Active'
          ? `${this.terminal_id}/${remote_terminal_id}`
          : `${remote_terminal_id}/${this.terminal_id}`,
    });
    this._mapTerminalIdToPeer[remote_terminal_id] = {
      session_id,
      maxMessageSize: 65536,
      peer,
    };

    peer.on('signal', (data) => {
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          direction,
          'signal',
          session_id,
          remote_terminal_id,
          data,
        );
      }
      subs.push(
        onSignal(data).subscribe({
          error: (err) => {
            console.error(formatTime(Date.now()), 'Error', err);
            this._mapTerminalIdToPeer[remote_terminal_id] = undefined;
            for (const sub of subs) {
              sub.unsubscribe();
            }
            onDestroy();
          },
        }),
      );
    });

    const data$ = fromEvent(peer, 'data').pipe(
      //
      tap((data: any) => {
        if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
          console.info(
            formatTime(Date.now()),
            'Terminal',
            'WebRTC',
            direction,
            'data',
            session_id,
            remote_terminal_id,
            data.length,
          );
        }
      }),
      map((v: any) => JSON.parse(v.toString())),
      share(),
    );

    const [chunkData$, completeData$] = partition(data$, (v: any) => v.method === 'WebRTC/Chunk');

    const resembledData$ = chunkData$.pipe(
      //
      groupBy((v) => v.trace_id),
      mergeMap((group) =>
        group.pipe(
          //
          takeWhile((data) => data.res === undefined),
          map((v) => v.frame),
          toArray(),
          map((v) =>
            v
              .sort((a, b) => a.seq - b.seq)
              .map((x) => x.body)
              .join(''),
          ),
          map((v) => JSON.parse(v)),
          timeout({ each: 15_000, meta: `WebRTC/Chunk Timeout: trace_id=${group.key}` }),
          catchError((err) => {
            console.error('Error', err);
            return EMPTY;
          }),
        ),
      ),
    );

    subs.push(
      completeData$
        .pipe(
          //
          mergeWith(resembledData$),
          tap((data) => {
            if (data.method) {
              TerminalReceiveMassageTotal.inc({
                target_terminal_id: this.terminal_id,
                source_terminal_id: remote_terminal_id,
                tunnel: 'WebRTC',
                method: data.method,
              });
            }
            if (data.channel_id) {
              TerminalReceiveChannelMassageTotal.inc({
                target_terminal_id: this.terminal_id,
                source_terminal_id: remote_terminal_id,
                tunnel: 'WebRTC',
                channel_id: data.channel_id,
              });
            }
          }),
        )
        .subscribe((msg) => this._input$.next(msg)),
    );

    peer.on('connect', () => {
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          direction,
          'connected',
          session_id,
          remote_terminal_id,
        );
      }
      // @ts-ignore
      const maxMessageSize = peer._pc.sctp?.maxMessageSize ?? 65536;
      this._mapTerminalIdToPeer[remote_terminal_id] = { session_id, maxMessageSize, peer };
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          direction,
          'maxMessageSize',
          maxMessageSize,
        );
      }
    });

    peer.on('close', () => {
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          direction,
          'closed',
          session_id,
          remote_terminal_id,
        );
      }
      this._mapTerminalIdToPeer[remote_terminal_id] = undefined;
      for (const sub of subs) {
        sub.unsubscribe();
      }
      onDestroy();
    });

    peer.on('error', (err) => {
      console.error(
        formatTime(Date.now()),
        'Terminal',
        'WebRTC',
        direction,
        'error',
        session_id,
        remote_terminal_id,
        err,
      );
      this._mapTerminalIdToPeer[remote_terminal_id] = undefined;
      for (const sub of subs) {
        sub.unsubscribe();
      }
      onDestroy();
    });

    return peer;
  }

  private _setupWebRTCTunnel() {
    console.info(formatTime(Date.now()), 'Terminal', 'WebRTC', 'Setup');

    this.provideService('WebRTC/Offer', {}, async (msg) => {
      const { session_id, offer } = msg.req as { session_id: string; offer: any };
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          'Passive',
          'Offer Received',
          session_id,
          msg.source_terminal_id,
          msg.req,
        );
      }
      const peerInfo = this._mapTerminalIdToPeer[msg.source_terminal_id];

      if (peerInfo !== undefined && peerInfo.session_id === session_id) {
        // same Session, check if connection is established
        if (!peerInfo.peer.connected) {
          peerInfo.peer.signal(offer);
        }
        return { res: { code: 200, message: 'OK' } };
      }

      if (peerInfo !== undefined && peerInfo.session_id !== session_id) {
        // NOTE: here are the conflict case, to resolve the conflict, we should give up the upper terminal_id' peer
        if (msg.source_terminal_id < msg.target_terminal_id) {
          if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
            console.info(
              formatTime(Date.now()),
              'Terminal',
              'WebRTC',
              'Passive',
              'GiveUp',
              session_id,
              msg.source_terminal_id,
              msg.req,
            );
          }
          peerInfo.peer.destroy();
          this._mapTerminalIdToPeer[msg.source_terminal_id] = undefined;
        } else {
          if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
            console.info(
              formatTime(Date.now()),
              'Terminal',
              'WebRTC',
              'Passive',
              'Conflict',
              session_id,
              msg.source_terminal_id,
              msg.req,
            );
          }
          return { res: { code: 409, message: 'Conflict' } };
        }
      }

      const peer = this._setupPeer({
        session_id,
        direction: 'Passive',
        remote_terminal_id: msg.source_terminal_id,
        onSignal: (data) => {
          return from(this.request('WebRTC/Answer', msg.source_terminal_id, { session_id, answer: data }));
        },
        onDestroy: () => {},
      });

      peer.signal(offer);
      return { res: { code: 200, message: 'OK' } };
    });

    this.provideService('WebRTC/Answer', {}, async (msg) => {
      const { session_id, answer } = msg.req as { session_id: string; answer: any };
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.info(
          formatTime(Date.now()),
          'Terminal',
          'WebRTC',
          'Active',
          'Answer Received',
          session_id,
          msg.source_terminal_id,
          msg.req,
        );
      }

      const peerInfo = this._mapTerminalIdToPeer[msg.source_terminal_id];

      if (peerInfo === undefined || peerInfo.session_id !== session_id) {
        return { res: { code: 404, message: 'Not Found' } };
      }

      peerInfo.peer.signal(answer);
      return { res: { code: 200, message: 'OK' } };
    });

    this._subscriptions.push(
      this._output$
        .pipe(
          map((msg) => msg.target_terminal_id),
          filter((x) => x !== this.terminal_id),
          groupBy((x) => x),
          mergeMap((group) =>
            group.pipe(
              withLatestFrom(this._terminalInfos$),
              exhaustMap(
                ([target_terminal_id, terminal_infos]) =>
                  new Observable((observer) => {
                    if (
                      !terminal_infos.find((x) => x.terminal_id === target_terminal_id && x.enable_WebRTC)
                    ) {
                      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
                        console.info(
                          formatTime(Date.now()),
                          'Terminal',
                          'WebRTC',
                          'Active',
                          'not enabled for',
                          target_terminal_id,
                        );
                      }
                      observer.complete();
                      return;
                    }

                    const peerInfo = this._mapTerminalIdToPeer[target_terminal_id];
                    if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
                      if (peerInfo !== undefined) {
                        console.info(
                          formatTime(Date.now()),
                          'Terminal',
                          'WebRTC',
                          'Active',
                          'already connected',
                          peerInfo.session_id,
                          target_terminal_id,
                        );
                        // NOTE: we don't complete the observer here to block the next active connection requests
                        return;
                      }
                    }
                    const session_id = UUID();
                    if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
                      console.info(
                        formatTime(Date.now()),
                        'Terminal',
                        'WebRTC',
                        'Active',
                        'connecting',
                        session_id,
                        target_terminal_id,
                      );
                    }
                    const _ = this._setupPeer({
                      session_id,
                      direction: 'Active',
                      remote_terminal_id: target_terminal_id,
                      onSignal: (data) => {
                        return from(
                          this.request('WebRTC/Offer', target_terminal_id, { session_id, offer: data }),
                        );
                      },
                      onDestroy: () => {
                        observer.complete();
                      },
                    });
                  }),
              ),
            ),
          ),
        )
        .subscribe(),
    );
  }

  private _setupTerminalInfoStuff() {
    // Periodically update the whole terminal list
    this._subscriptions.push(
      defer(() => this.request('ListTerminals', '@host', {}))
        .pipe(
          filter((msg) => !!msg.res),
          map((msg) => msg.res?.data ?? []),
          mergeMap((x) => x),
          // ISSUE: filter out terminals that have not been updated for a long time
          // filter((x) => Date.now() - x.updated_at! < 60_000),
          toArray(),
          timeout(5000),
          retry({ delay: 1000 }),
          // ISSUE: Storage workload
          repeat({ delay: 10000 }),
        )
        .subscribe((list) => {
          this._terminalInfos$.next(list);
        }),
    );

    // Receive TerminalInfo from the channel
    this._subscriptions.push(
      defer(() => this.consumeChannel<ITerminalInfo>('TerminalInfo'))
        .pipe(
          mergeMap((x) =>
            this._terminalInfos$.pipe(
              first(),
              map((list) => {
                const idx = list.findIndex((y) => y.terminal_id === x.terminal_id);
                if (idx === -1) {
                  return [...list, x];
                }
                list[idx] = x;
                return list;
              }),
              tap((list) => {
                this._terminalInfos$.next(list);
              }),
            ),
          ),
        )
        .subscribe(),
    );

    this._subscriptions.push(
      this._terminalInfoUpdated$
        .pipe(
          tap(() => console.info(formatTime(Date.now()), 'Terminal', 'terminalInfo', 'updating')),
          debounceTime(10),
          tap(() => (this.terminalInfo.updated_at = Date.now())),
          tap(() => console.info(formatTime(Date.now()), 'Terminal', 'terminalInfo', 'pushing')),
          // request maybe failed, so we should retry until success or cancelled by new pushing action
          switchMap(() =>
            defer(() => this.request('UpdateTerminalInfo', '@host', this.terminalInfo)).pipe(
              tap((msg) =>
                console.info(formatTime(Date.now()), 'Terminal', 'terminalInfo', 'pushed', msg.res?.code),
              ),
              timeout(5000),
              retry({ delay: 1000 }),
            ),
          ),
        )
        .subscribe(() => {}),
    );

    // while reconnection
    from(this._conn.connection$).subscribe(() => {
      this._terminalInfoUpdated$.next();
    });

    // First Emit
    this._terminalInfoUpdated$.next();
  }

  private _subscriptions: Subscription[] = [];

  private _input$ = new Subject<ITerminalMessage>();
  private _output$ = new Subject<ITerminalMessage>();
  private _dispose$ = new Subject<void>();

  /**
   * Observable that emits when a message is received
   */
  input$: AsyncIterable<ITerminalMessage> = observableToAsyncIterable(this._input$);
  /**
   * Observable that emits when a message is sent
   */
  output$: AsyncIterable<ITerminalMessage> = observableToAsyncIterable(this._output$);
  /**
   * Observable that emits when the terminal is disposed
   */
  dispose$: AsyncIterable<void> = observableToAsyncIterable(this._dispose$);

  /**
   * Dispose the terminal
   */
  dispose() {
    this._output$.complete();
    this._conn.output$.return?.(); // close the WS connection
    this._subscriptions.forEach((sub) => sub.unsubscribe());
    this._dispose$.next();
  }

  /**
   * Make a request to specified terminal's service
   */
  request<T extends string>(
    method: T,
    target_terminal_id: string,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): AsyncIterable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    const trace_id = UUID();
    const msg = {
      trace_id,
      method,
      target_terminal_id,
      source_terminal_id: this.terminal_id,
      req,
    };
    return observableToAsyncIterable(
      defer((): Observable<any> => {
        this._output$.next(msg);
        return this._input$.pipe(
          filter((m) => m.trace_id === msg.trace_id),
          // complete immediately when res is received
          takeWhile((msg1) => msg1.res === undefined, true),
          timeout({
            first: 30000,
            each: 10000,
            meta: `request Timeout: method=${msg.method} target=${msg.target_terminal_id}`,
          }),
          share(),
        );
      }),
    );
  }

  /**
   * Provide a service
   */
  provideService = <T extends string>(
    method: T,
    requestSchema: JSONSchema7,
    handler: IServiceHandler<T>,
    options?: IServiceOptions,
  ) => {
    //
    (this.terminalInfo.serviceInfo ??= {})[method] = { method, schema: requestSchema };
    // @ts-ignore
    this._serviceHandlers[method] = handler;
    this._serviceOptions[method] = options || {};
    this._terminalInfoUpdated$.next();
  };

  /**
   * Resolve candidate target_terminal_ids for a request
   */
  resolveTargetTerminalIds = async (method: string, req: ITerminalMessage['req']): Promise<string[]> =>
    firstValueFrom(
      this._terminalInfos$.pipe(first()).pipe(
        mergeMap((terminalInfos) =>
          from(terminalInfos).pipe(
            //
            filter((terminalInfo) =>
              this._mapTerminalIdAndMethodToValidator[terminalInfo.terminal_id]?.[method]?.(req),
            ),
          ),
        ),
        map((terminalInfo) => terminalInfo.terminal_id),
        toArray(),
      ),
    );

  /**
   * Make a request to a service
   */
  requestService = <T extends string>(
    method: T,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): AsyncIterable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> => {
    return observableToAsyncIterable(
      defer(() => this.resolveTargetTerminalIds(method, req)).pipe(
        map((arr) => {
          if (arr.length === 0) {
            throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
          }
          const target = arr[~~(Math.random() * arr.length)]; // Simple Random Load Balancer
          return target;
        }),
        mergeMap((target_terminal_id) => this.request(method, target_terminal_id, req)),
      ),
    );
  };

  private _setupDebugLog = () => {
    const sub1 = this._input$.subscribe((msg) => {
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.debug(
          formatTime(Date.now()),
          'Terminal',
          'RX',
          msg.trace_id,
          msg.method,
          msg.res?.code ?? '',
          msg.res?.message ?? '',
        );
      }
    });
    const sub2 = this._output$.subscribe((msg) => {
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.debug(
          formatTime(Date.now()),
          'Terminal',
          'TX',
          msg.trace_id,
          msg.method,
          msg.res?.code ?? '',
          msg.res?.message ?? '',
        );
      }
    });
    this._subscriptions.push(sub1, sub2);
  };

  private _subscribeChannel = (provider_terminal_id: string, channel_id: string) => {
    console.info(formatTime(Date.now()), 'Terminal', 'subscribe', channel_id, 'to', provider_terminal_id);
    // Assume that it's low frequency to subscribe a channel
    const channels = ((this.terminalInfo.subscriptions ??= {})[provider_terminal_id] ??= []);
    if (channels.includes(channel_id)) return;
    channels.push(channel_id);
    this._terminalInfoUpdated$.next();
  };

  private _unsubscribeChannel = (provider_terminal_id: string, channel_id: string) => {
    console.info(formatTime(Date.now()), 'Terminal', 'unsubscribe', channel_id, 'to', provider_terminal_id);
    // Assume that it's low frequency to unsubscribe a channel
    if (!this.terminalInfo.subscriptions) return;
    const channels = this.terminalInfo.subscriptions[provider_terminal_id];
    if (!channels) return;
    const idx = channels.indexOf(channel_id);
    if (idx === -1) return;
    channels.splice(idx, 1);
    this._terminalInfoUpdated$.next();
    if (channels.length > 0) return;
    delete this.terminalInfo.subscriptions[provider_terminal_id];
    this._terminalInfoUpdated$.next();
    if (Object.keys(this.terminalInfo.subscriptions).length > 0) return;
    delete this.terminalInfo.subscriptions;
    this._terminalInfoUpdated$.next();
  };

  private _setupServer = () => {
    const sub = this._input$
      .pipe(
        filter((msg) => msg.method !== undefined && msg.frame === undefined && msg.res === undefined),
        groupBy((msg) => msg.method!),
        mergeMap((group) => {
          const handler = this._serviceHandlers[group.key];
          const concurrency = this._serviceOptions[group.key]?.concurrent ?? Infinity;

          if (!handler) {
            return EMPTY;
          }

          const preHandleAction$ = new Subject<{ req: ITerminalMessage }>();
          const postHandleAction$ = new Subject<{ req: ITerminalMessage; res: ITerminalMessage }>();

          // ISSUE: Keepalive for every queued request before they are handled,
          preHandleAction$.subscribe(({ req }) => {
            const sub = interval(5000).subscribe(() => {
              this._output$.next({
                trace_id: req.trace_id,
                method: req.method,
                // ISSUE: Reverse source / target as response, otherwise the host cannot guarantee the forwarding direction
                source_terminal_id: this.terminal_id,
                target_terminal_id: req.source_terminal_id,
              });
            });

            postHandleAction$
              .pipe(
                //
                first(({ req: req1 }) => req1 === req),
              )
              .subscribe(() => {
                sub.unsubscribe();
              });
          });

          // Metrics
          preHandleAction$.subscribe(({ req }) => {
            const tsStart = Date.now();
            if (req.method) {
              RequestReceivedTotal.inc({
                method: req.method,
                source_terminal_id: req.source_terminal_id,
                target_terminal_id: req.target_terminal_id,
              });
            }

            postHandleAction$.pipe(first(({ req: req1 }) => req1 === req)).subscribe(({ req, res }) => {
              if (req.method) {
                RequestDurationBucket.observe(Date.now() - tsStart, {
                  method: req.method,
                  source_terminal_id: req.source_terminal_id,
                  target_terminal_id: req.target_terminal_id,
                  code: res.res?.code ?? 520,
                });
              }
            });
          });

          return group.pipe(
            tap((msg) => {
              preHandleAction$.next({ req: msg });
            }),
            groupBy((msg) => msg.source_terminal_id),
            // Token Bucket Algorithm
            mergeMap((subGroup) =>
              subGroup.pipe(
                rateLimitMap(
                  (msg) => {
                    return of(msg);
                  },
                  (msg) => {
                    return of({
                      res: { code: 429, message: `Too Many Requests` },
                      trace_id: msg.trace_id,
                      method: msg.method,
                      source_terminal_id: msg.source_terminal_id,
                      target_terminal_id: msg.target_terminal_id,
                    });
                  },
                  this._serviceOptions[subGroup.key]?.rateLimitConfig,
                ),
              ),
            ),
            mergeMap((msg) => {
              const output$ = new Subject<
                Omit<ITerminalMessage, 'trace_id' | 'method' | 'source_terminal_id' | 'target_terminal_id'>
              >();
              const nativeOutput$ = subjectToNativeSubject(output$);
              const res$: Observable<
                Omit<ITerminalMessage, 'trace_id' | 'method' | 'source_terminal_id' | 'target_terminal_id'>
              > = msg.res ? of(msg) : defer(() => handler(msg, nativeOutput$));
              // ISSUE: output$.pipe(...) must be returned first to ensure that mergeMap has been subscribed before res$ starts write into output$
              setTimeout(() => {
                res$.subscribe(output$);
              }, 0);
              return output$.pipe(
                catchError((err) => {
                  console.error(formatTime(Date.now()), `ServerError`, msg, err);
                  // TODO: add Metric Error here
                  return of({
                    res: { code: 500, message: `InternalError: ${err}` },
                  });
                }),
                timeout({
                  first: 30000,
                  each: 10000,
                  meta: `handler Timeout: method=${msg.method} target=${msg.source_terminal_id}`,
                }),
                catchError((err) => {
                  return of({
                    res: { code: 504, message: `Gateway Timeout: ${err}` },
                  });
                }),
                takeWhile((res) => res.res === undefined, true),
                map(
                  (
                    res: Omit<
                      ITerminalMessage,
                      'trace_id' | 'method' | 'source_terminal_id' | 'target_terminal_id'
                    >,
                  ) => ({
                    ...res,
                    trace_id: msg.trace_id,
                    method: msg.method,
                    // ISSUE: Reverse source / target as response, otherwise the host cannot guarantee the forwarding direction
                    source_terminal_id: this.terminal_id,
                    target_terminal_id: msg.source_terminal_id,
                  }),
                ),
                tap((res: ITerminalMessage) => {
                  if (res.res !== undefined) {
                    postHandleAction$.next({ req: msg, res });
                  }
                }),
              );
            }, concurrency),
          );
        }),
      )
      .subscribe((msg) => {
        this._output$.next(msg);
      });
    this._subscriptions.push(sub);
  };

  private _setupPredefinedServerHandlers = () => {
    this.provideService('Ping', {}, () => [{ res: { code: 0, message: 'Pong' } }]);

    this.provideService('Metrics', {}, async () => ({
      res: { code: 0, message: 'OK', data: { metrics: PromRegistry.metrics() } },
    }));

    if (isNode) {
      // Setup Process Metrics
      this._subscriptions.push(
        timer(0, 5000)
          .pipe(
            tap(() => {
              const usage = process.resourceUsage();
              for (const key in usage) {
                MetricsProcessResourceUsage.set(usage[key as keyof NodeJS.ResourceUsage], {
                  type: key,
                  terminal_id: this.terminal_id,
                });
              }
            }),
            tap(() => {
              const usage = process.memoryUsage();
              for (const key in usage) {
                MetricsProcessMemoryUsage.set(usage[key as keyof NodeJS.MemoryUsage], {
                  type: key,
                  terminal_id: this.terminal_id,
                });
              }
            }),
          )
          .subscribe(),
      );

      this.provideService('Terminate', {}, function* () {
        yield { res: { code: 0, message: 'OK' } };
        timer(1000).subscribe(() => process.exit(0));
      });
    }
  };

  /**
   * Provide a channel
   * @param channelIdSchema - JSON Schema for channel_id
   * @param handler - handler for the channel, return an Observable to provide data stream
   */
  provideChannel = <T>(channelIdSchema: JSONSchema7, handler: (channel_id: string) => ObservableInput<T>) => {
    const validate = new Ajv({ strict: false }).compile(channelIdSchema);
    (this.terminalInfo.channelIdSchemas ??= []).push(channelIdSchema);
    this._terminalInfoUpdated$.next();

    // map terminalInfos to Record<channel_id, target_terminal_id[]>
    const mapChannelIdToTargetTerminalIds$ = this._terminalInfos$.pipe(
      mergeMap((x) =>
        from(x).pipe(
          mergeMap((terminalInfo) =>
            from(terminalInfo.subscriptions?.[this.terminal_id] ?? []).pipe(
              filter((channel_id) => validate(channel_id)),
              map((channel_id) => ({ consumer_terminal_id: terminalInfo.terminal_id, channel_id })),
            ),
          ),
          groupBy((x) => x.channel_id),
          mergeMap((group) =>
            group.pipe(
              map((x) => x.consumer_terminal_id),
              toArray(),
              map((arr) => [group.key, arr] as [string, string[]]),
            ),
          ),
          toArray(),
          map((entries) => Object.fromEntries(entries)),
        ),
      ),
      shareReplay(1),
    );

    const mapChannelIdToSubject: Record<string, Observable<T>> = {};
    const sub = mapChannelIdToTargetTerminalIds$.subscribe((theMap) => {
      for (const channel_id of Object.keys(theMap)) {
        if (!mapChannelIdToSubject[channel_id]) {
          // NOTE: the payload should be immediately sent to the consumer.
          mapChannelIdToSubject[channel_id] = defer(() => handler(channel_id)).pipe(
            catchError((err) => {
              console.error(formatTime(Date.now()), 'Terminal', 'provideChannel', 'error', channel_id, err);
              return EMPTY;
            }),
          );
          const subscriptionToHandler = mapChannelIdToSubject[channel_id].subscribe((payload) => {
            mapChannelIdToTargetTerminalIds$.pipe(first()).subscribe((theMap) => {
              const target_terminal_ids = theMap[channel_id];
              if (!target_terminal_ids) {
                // unsubscribe if no consumer
                subscriptionToHandler.unsubscribe();
                delete mapChannelIdToSubject[channel_id];
                return;
              }
              // multicast to all consumers
              for (const target_terminal_id of target_terminal_ids) {
                this._output$.next({
                  trace_id: UUID(),
                  channel_id,
                  frame: payload,
                  source_terminal_id: this.terminal_id,
                  target_terminal_id,
                });
              }
            });
          });
        }
      }
    });
    this._subscriptions.push(sub);
  };

  private _mapChannelIdToSubject: Record<string, Observable<any>> = {};

  // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
  private _mapTerminalIdToChannelValidators: Record<string, ValidateFunction[]> = {};

  private _setupChannelValidatorSubscription() {
    this._subscriptions.push(
      this._terminalInfos$
        .pipe(
          mergeAll(),
          groupBy((v) => v.terminal_id),
          mergeMap((groupByTerminalId) =>
            groupByTerminalId.pipe(
              mergeMap((terminalInfo) => of(terminalInfo.channelIdSchemas || [])),
              distinctUntilChanged(
                (schemas1, schemas2) => JSON.stringify(schemas1) === JSON.stringify(schemas2),
              ),
              tap((schemas) => {
                this._mapTerminalIdToChannelValidators[groupByTerminalId.key] = schemas.map((schema) =>
                  new Ajv({ strict: false }).compile(schema),
                );
              }),
            ),
          ),
        )
        .subscribe(),
    );
  }

  /**
   * Consume a channel
   * @param channel_id - channel_id
   */
  consumeChannel = <T>(channel_id: string): AsyncIterable<T> =>
    // Cache by channel_id
    observableToAsyncIterable(
      (this._mapChannelIdToSubject[channel_id] ??= new Observable<T>((subscriber) => {
        console.info(formatTime(Date.now()), 'Terminal', 'consumeChannel', 'subscribe', channel_id);
        // candidate target_terminal_id list
        const candidates$ = this._terminalInfos$.pipe(
          mergeMap((x) =>
            from(x).pipe(
              filter((terminalInfo) =>
                this._mapTerminalIdToChannelValidators[terminalInfo.terminal_id]?.some((validator) =>
                  validator(channel_id),
                ),
              ),
              map((x) => x.terminal_id),
              toArray(),
            ),
          ),
          shareReplay(1),
        );
        let provider_terminal_id: string | undefined;
        const sub = candidates$.subscribe((candidates) => {
          if (provider_terminal_id && !candidates.includes(provider_terminal_id)) {
            this._unsubscribeChannel(provider_terminal_id, channel_id);
            provider_terminal_id = undefined;
          }
          if (
            (!provider_terminal_id && candidates.length > 0) ||
            (provider_terminal_id && candidates.length > 0 && !candidates.includes(provider_terminal_id))
          ) {
            provider_terminal_id = candidates[~~(Math.random() * candidates.length)]; // Simple Random Load Balancer
            this._subscribeChannel(provider_terminal_id, channel_id);
          }
        });
        this._subscriptions.push(sub);
        const sub1 = this._input$
          .pipe(
            filter((msg) => msg.channel_id === channel_id && msg.source_terminal_id === provider_terminal_id),
            map((msg) => msg.frame as T),
          )
          .subscribe((payload) => {
            subscriber.next(payload);
          });
        this._subscriptions.push(sub1);
        return () => {
          console.info(formatTime(Date.now()), 'Terminal', 'consumeChannel', 'unsubscribe', channel_id);
          sub1.unsubscribe();
        };
      }).pipe(
        //
        shareReplay({ bufferSize: 1, refCount: true }),
      )),
    );

  private _terminalInfos$ = new ReplaySubject<ITerminalInfo[]>(1);
  /**
   * Terminal List of the same host
   */
  terminalInfos$: AsyncIterable<ITerminalInfo[]> = observableToAsyncIterable(this._terminalInfos$);

  // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
  private _mapTerminalIdAndMethodToValidator: Record<string, Record<string, ValidateFunction>> = {};

  private _setupTerminalIdAndMethodValidatorSubscription() {
    this._subscriptions.push(
      this._terminalInfos$
        .pipe(
          //
          mergeAll(),
          groupBy((v) => v.terminal_id),
          mergeMap((groupByTerminalId) =>
            groupByTerminalId.pipe(
              mergeMap((terminalInfo) => Object.entries(terminalInfo.serviceInfo || {})),
              groupBy(([method]) => method),
              mergeMap((groupByMethod) =>
                groupByMethod.pipe(
                  distinctUntilChanged(
                    ([, { schema: schema1 }], [, { schema: schema2 }]) =>
                      JSON.stringify(schema1) === JSON.stringify(schema2),
                  ),
                  tap(([, { schema }]) => {
                    (this._mapTerminalIdAndMethodToValidator[groupByTerminalId.key] ??= {})[
                      groupByMethod.key
                    ] = new Ajv({ strict: false }).compile(schema);
                  }),
                ),
              ),
            ),
          ),
        )
        .subscribe(),
    );
  }
}
