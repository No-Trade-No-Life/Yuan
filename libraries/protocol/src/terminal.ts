import { UUID, formatTime } from '@yuants/data-model';
import Ajv from 'ajv';
import { isNode } from 'browser-or-node';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  ReplaySubject,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  defer,
  exhaustMap,
  filter,
  first,
  from,
  fromEvent,
  groupBy,
  map,
  mergeMap,
  mergeWith,
  partition,
  repeat,
  retry,
  share,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
  timeout,
  timer,
  toArray,
  withLatestFrom,
} from 'rxjs';
import type SimplePeer from 'simple-peer';
import { TerminalChannel } from './channel';
import { TerminalClient } from './client';
import { IConnection, createConnectionWs } from './create-connection';
import {
  IServiceHandler,
  IServiceInfo,
  IServiceInfoServerSide,
  IServiceOptions,
  ITerminalInfo,
} from './model';
import { TerminalServer } from './server';
import { IService, ITerminalMessage } from './services';
import { MetricsExporter, PromRegistry, TerminalMeter } from './services/metrics';
import { inferNodePackageTags } from './tags/inferVersionTags';
import { getSimplePeerInstance } from './webrtc';

const TerminalReceivedBytesTotal = TerminalMeter.createCounter('terminal_received_bytes_total');
const TerminalTransmittedBytesTotal = TerminalMeter.createCounter('terminal_transmitted_bytes_total');
const TerminalReceiveMassageTotal = TerminalMeter.createCounter('terminal_receive_message_total');
const TerminalTransmittedMessageTotal = TerminalMeter.createCounter('terminal_transmitted_message_total');

const MetricsProcessMemoryUsage = TerminalMeter.createGauge('nodejs_process_memory_usage', {
  description: 'nodejs process memoryUsage',
});

const MetricsProcessResourceUsage = TerminalMeter.createGauge('nodejs_process_resource_usage', {
  description: 'nodejs process resourceUsage',
});

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

  /**
   * Terminal Message Header Flag
   */
  private has_header: boolean;

  private _terminalInfoUpdated$ = new Subject<void>();

  /**
   * if the terminal is connected to host
   */
  isConnected$: AsyncIterable<boolean>;

  constructor(
    public host_url: string,
    public terminalInfo: ITerminalInfo,
    public options: {
      verbose?: boolean;
      disableTerminate?: boolean;
      disableMetrics?: boolean;
      connection?: IConnection<string>;
    } = {},
  ) {
    this.terminal_id = this.terminalInfo.terminal_id || UUID();
    const tags: Record<string, string> = {};
    this.terminalInfo = {
      ...terminalInfo,
      terminal_id: this.terminal_id,
      serviceInfo: {},
      tags,
    };

    Object.assign(tags, inferNodePackageTags());
    Object.assign(tags, terminalInfo.tags);

    // Infer Public IP
    defer(() =>
      fetch('https://ifconfig.me/ip')
        .then((res) => res.text())
        .then((public_ip) => {
          Object.assign(tags, { public_ip });
          this._terminalInfoUpdated$.next();
        }),
    )
      .pipe(
        //
        retry({ delay: 30_000 }),
        takeUntil(this.dispose$),
      )
      .subscribe();

    if (isNode) {
      this.options.verbose ??= true;
    }

    const url = new URL(host_url);
    url.searchParams.set('terminal_id', this.terminal_id); // make sure terminal_id is in the connection parameters
    this.host_url = url.toString();
    this.has_header = url.searchParams.get('has_header') === 'true';

    this._conn = this.options.connection || createConnectionWs(this.host_url);
    this.isConnected$ = this._conn.isConnected$;
    this._setupTunnel();
    this._setupDebugLog();
    this._setupPredefinedServerHandlers();

    this.terminalInfo.created_at = Date.now();

    this._setupTerminalInfoStuff();
  }

  private _mapTerminalIdToPeer: Record<
    string,
    { session_id: string; maxMessageSize: number; peer: SimplePeer.Instance } | undefined
  > = {};

  private _parseMsgFromWs = (msg: string): ITerminalMessage => {
    //
    TerminalReceivedBytesTotal.add(msg.length, {
      terminal_id: this.terminal_id,
      tunnel: 'WS',
    });

    if (this.has_header) {
      return JSON.parse(msg.slice(msg.indexOf('\n') + 1));
    }
    return JSON.parse(msg);
  };

  private _sendMsgByWs = (msg: ITerminalMessage): void => {
    //
    if (this.has_header) {
      const headers = {
        target_terminal_id: msg.target_terminal_id,
        source_terminal_id: msg.source_terminal_id,
      };
      this._conn.output$.next(JSON.stringify(headers) + '\n' + JSON.stringify(msg));
      return;
    }

    const content = JSON.stringify(msg);
    TerminalTransmittedBytesTotal.add(content.length, {
      terminal_id: this.terminal_id,
      tunnel: 'WS',
    });

    this._conn.output$.next(content);
  };

  private _setupTunnel() {
    this._subscriptions.push(
      from(this._conn.input$)
        .pipe(
          map((msg) => msg.toString()),
          map((msg): ITerminalMessage => this._parseMsgFromWs(msg)),
        )
        .subscribe((msg) => {
          if (msg.method) {
            TerminalReceiveMassageTotal.add(1, {
              target_terminal_id: msg.target_terminal_id,
              source_terminal_id: msg.source_terminal_id,
              tunnel: 'WS',
              method: msg.method,
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
          TerminalTransmittedMessageTotal.add(1, {
            target_terminal_id: msg.target_terminal_id,
            source_terminal_id: msg.source_terminal_id,
            tunnel: peerInfo !== undefined && peerInfo.peer.connected ? 'WebRTC' : 'WS',
            method: msg.method,
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
              this._sendMsgByWs(msg);
            }
          });
          return;
        }

        this._sendMsgByWs(msg);
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
              TerminalReceiveMassageTotal.add(1, {
                target_terminal_id: this.terminal_id,
                source_terminal_id: remote_terminal_id,
                tunnel: 'WebRTC',
                method: data.method,
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
          console.info(formatTime(Date.now()), 'Terminal', 'ListTerminalInfo', list.length);
          this.terminalInfos = list;
          this._terminalInfos$.next(list);
        }),
    );

    // Receive TerminalInfo from the channel
    this._subscriptions.push(
      defer(() => this.channel.subscribeChannel<ITerminalInfo>('TerminalInfo'))
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
                console.info(
                  formatTime(Date.now()),
                  'Terminal',
                  'TerminalInfoUpdate',
                  x.terminal_id,
                  list.length,
                );
                this.terminalInfos = list;
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
                console.info(
                  formatTime(Date.now()),
                  'Terminal',
                  'terminalInfo',
                  'pushed',
                  msg.res?.code,
                  msg.trace_id,
                ),
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
  input$ = this._input$;
  /**
   * Subject that emits when a message is sent
   */
  output$ = this._output$;
  /**
   * Observable that emits when the terminal is disposed
   */
  dispose$ = this._dispose$;

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
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    return this.client.request(method, target_terminal_id, req);
  }

  /**
   * Provide a service
   */
  provideService<T extends string>(
    method: T,
    requestSchema: JSONSchema7,
    handler: IServiceHandler<T>,
    options?: IServiceOptions,
  ): { dispose: () => void } {
    const service_id = UUID();
    const serviceInfo: IServiceInfo = { service_id, method, schema: requestSchema };

    // update terminalInfo
    (this.terminalInfo.serviceInfo ??= {})[service_id] = serviceInfo;
    this._terminalInfoUpdated$.next();

    const service: IServiceInfoServerSide = {
      serviceInfo,
      handler: handler as any,
      options: options || {},
      validator: new Ajv({ strict: false, strictSchema: false }).compile(requestSchema),
    };
    // update service object
    this.server.addService(service);
    const dispose = () => {
      delete this.terminalInfo.serviceInfo?.[service_id];
      this._terminalInfoUpdated$.next();
      this.server.removeService(service_id);
    };
    return { dispose };
  }

  /**
   * Resolve candidate target_terminal_ids for a request
   */
  resolveTargetTerminalIds = (method: string, req: ITerminalMessage['req']): Promise<string[]> => {
    return this.client.resolveTargetTerminalIds(method, req);
  };

  /**
   * Make a request to a service
   *
   * - [x] SINGLE-IN-SINGLE-OUT
   * - [x] SINGLE-IN-STREAM-OUT
   * - [ ] STREAM-IN-SINGLE-OUT
   * - [ ] STREAM-IN-STREAM-OUT
   */
  requestService<T extends keyof IService>(
    method: T,
    req: IService[T]['req'],
  ): Observable<Partial<IService[T]> & ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): Observable<ITerminalMessage>;

  requestService(method: string, req: ITerminalMessage['req']): Observable<ITerminalMessage> {
    return this.client.requestService(method, req);
  }

  /**
   * Make a request to get the response
   *
   * Use it only when using SINGLE-IN-SINGLE-OUT pattern.
   *
   * It's simpler to call this method when using this pattern.
   *
   * - [x] SINGLE-IN-SINGLE-OUT
   * - [ ] SINGLE-IN-STREAM-OUT
   * - [ ] STREAM-IN-SINGLE-OUT
   * - [ ] STREAM-IN-STREAM-OUT
   */
  requestForResponse<T extends keyof IService>(
    method: T,
    req: IService[T]['req'],
  ): Promise<Exclude<(Partial<IService[T]> & ITerminalMessage)['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
  ): Promise<Exclude<ITerminalMessage['res'], undefined>>;

  requestForResponse(
    method: string,
    req: ITerminalMessage['req'],
  ): Promise<Exclude<ITerminalMessage['res'], undefined>> {
    return this.client.requestForResponse(method, req);
  }

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

  private _setupPredefinedServerHandlers = () => {
    this.provideService('Ping', {}, () => [{ res: { code: 0, message: 'Pong' } }]);

    if (!this.options.disableMetrics) {
      this.provideService('Metrics', {}, async () => {
        const metrics = await MetricsExporter.export();
        return {
          res: {
            code: 0,
            message: 'OK',
            data: { metrics: `${PromRegistry.metrics()}\n${metrics}` },
          },
        };
      });
    }

    if (isNode) {
      // Setup Process Metrics
      this._subscriptions.push(
        timer(0, 5000)
          .pipe(
            tap(() => {
              const usage = process.resourceUsage();
              for (const key in usage) {
                MetricsProcessResourceUsage.record(usage[key as keyof NodeJS.ResourceUsage], {
                  type: key,
                  terminal_id: this.terminal_id,
                });
              }
            }),
            tap(() => {
              const usage = process.memoryUsage();
              for (const key in usage) {
                MetricsProcessMemoryUsage.record(usage[key as keyof NodeJS.MemoryUsage], {
                  type: key,
                  terminal_id: this.terminal_id,
                });
              }
            }),
          )
          .subscribe(),
      );

      if (!this.options.disableTerminate) {
        this.provideService('Terminate', {}, function* () {
          yield { res: { code: 0, message: 'OK' } };
          timer(1000).subscribe(() => process.exit(0));
        });
      }
    }
  };

  terminalInfos: ITerminalInfo[] = [];
  private _terminalInfos$ = new ReplaySubject<ITerminalInfo[]>(1);
  /**
   * Terminal List of the same host
   */
  terminalInfos$ = this._terminalInfos$.asObservable();

  server: TerminalServer = new TerminalServer(this);
  client: TerminalClient = new TerminalClient(this);
  channel: TerminalChannel = new TerminalChannel(this);
}
