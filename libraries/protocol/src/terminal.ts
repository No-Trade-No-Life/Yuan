import { UUID, formatTime } from '@yuants/utils';
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
  interval,
  map,
  mergeMap,
  mergeWith,
  partition,
  repeat,
  repeatWhen,
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
import { MetricsExporter, MetricsMeterProvider, PromRegistry } from './metrics';
import { IServiceHandler, IServiceOptions, ITerminalInfo, ITerminalMessage } from './model';
import { TerminalServer } from './server';
import { inferNodePackageTags } from './tags/inferVersionTags';
import { getSimplePeerInstance } from './webrtc';

const TerminalMeter = MetricsMeterProvider.getMeter('terminal');

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

const MetricsProcessFileSystemStat = TerminalMeter.createGauge('nodejs_process_file_system_stat', {
  description: 'nodejs process file system stat',
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

  terminalInfoUpdated$ = new Subject<void>();

  /**
   * if the terminal is connected to host
   */
  isConnected$: Observable<boolean>;

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
          this.terminalInfoUpdated$.next();
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
    url.searchParams.set('has_header', 'true'); // enforce header mode
    this.host_url = url.toString();

    this._conn = this.options.connection || createConnectionWs(this.host_url);
    this.isConnected$ = this._conn.isConnected$;
    this._setupTunnel();
    this._setupDebugLog();
    this._setupPredefinedServerHandlers();

    this.terminalInfo.created_at = Date.now();

    this._setupTerminalInfoStuff();
  }

  private static _terminal: Terminal | null = null;

  /**
   * Create a default singleton terminal from Node.js environment variables
   *
   * You can call this method everywhere if you only need one terminal in a nodejs process
   *
   * Env:
   *
   * - `HOST_URL`: the host url (required)
   * - `TERMINAL_ID`: the terminal id (default random UUID, should be unique in the host)
   * - `TERMINAL_NAME`: the terminal name (default empty)
   * - `ENABLE_WEBRTC`: enable WebRTC connection (default false)
   */
  static fromNodeEnv(): Terminal {
    if (!isNode) throw new Error('Terminal.fromNodeEnv() can only be used in Node.js environment');
    if (this._terminal) {
      return this._terminal;
    }
    const HOST_URL = process.env.HOST_URL;
    if (!HOST_URL) {
      throw new Error('env HOST_URL is not set');
    }
    return (this._terminal = new Terminal(HOST_URL, {
      terminal_id: process.env.TERMINAL_ID || `DefaultTerminal/${UUID()}`,
      name: process.env.TERMINAL_NAME || '',
      enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
    }));
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

    return JSON.parse(msg.slice(msg.indexOf('\n') + 1));
  };

  private _sendMsgByWs = (msg: ITerminalMessage): void => {
    const headers = {
      target_terminal_id: msg.target_terminal_id,
      source_terminal_id: msg.source_terminal_id,
    };
    const content = JSON.stringify(headers) + '\n' + JSON.stringify(msg);
    TerminalTransmittedBytesTotal.add(content.length, {
      terminal_id: this.terminal_id,
      tunnel: 'WS',
    });
    this._conn.output$.next(content);
    return;
  };

  private _setupTunnel() {
    from(this._conn.input$)
      .pipe(
        takeUntil(this.dispose$),
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
      });

    if (this.terminalInfo.enable_WebRTC) {
      this._setupWebRTCTunnel();
    }

    this._output$.pipe(takeUntil(this.dispose$)).subscribe((msg) => {
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
    });
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

    this.server.provideService<{ session_id: string; offer: any }>('WebRTC/Offer', {}, async (msg) => {
      const { session_id, offer } = msg.req;
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
          return from(
            this.client.request('WebRTC/Answer', msg.source_terminal_id, { session_id, answer: data }),
          );
        },
        onDestroy: () => {},
      });

      peer.signal(offer);
      return { res: { code: 200, message: 'OK' } };
    });

    this.server.provideService<{ session_id: string; answer: any }>('WebRTC/Answer', {}, async (msg) => {
      const { session_id, answer } = msg.req;
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

    this._output$
      .pipe(
        takeUntil(this.dispose$),
        map((msg) => msg.target_terminal_id),
        filter((x) => x !== this.terminal_id),
        groupBy((x) => x),
        mergeMap((group) =>
          group.pipe(
            withLatestFrom(this._terminalInfos$),
            exhaustMap(
              ([target_terminal_id, terminal_infos]) =>
                new Observable((observer) => {
                  if (!terminal_infos.find((x) => x.terminal_id === target_terminal_id && x.enable_WebRTC)) {
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
                        this.client.request('WebRTC/Offer', target_terminal_id, {
                          session_id,
                          offer: data,
                        }),
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
      .subscribe();
  }

  private _setupTerminalInfoStuff() {
    // Periodically update the whole terminal list
    let ack_seq_id = -1;

    const refresh$ = new Subject<void>();

    defer(() =>
      this.client.request<{}, { terminals: ITerminalInfo[]; seq_id: number }>(
        'GetTerminalInfos',
        '@host',
        {},
      ),
    )
      .pipe(
        takeUntil(this.dispose$),
        map((msg) => msg.res?.data),
        filter((x): x is Exclude<typeof x, undefined> => !!x),
        first(),
        tap((data) => {
          // 如果没有 @host，会导致无法收到后续的 TerminalInfo 更新，必须重试
          if (!data.terminals.some((x) => x.terminal_id === '@host')) {
            if (this.options.verbose) {
              console.info(
                formatTime(Date.now()),
                'Terminal',
                'GetTerminalInfos',
                'Host TerminalInfo not found, retrying...',
              );
            }
            throw '';
          }
        }),
        timeout(10_000),
        retry({ delay: 1000 }),
        tap((data) => {
          if (this.options.verbose) {
            console.info(
              formatTime(Date.now()),
              'Terminal',
              'GetTerminalInfos',
              `terminals = ${data.terminals.length}, seq_id = ${data.seq_id}`,
            );
          }
          ack_seq_id = data.seq_id;
          this.terminalInfos = data.terminals;
          this._terminalInfos$.next(data.terminals);
        }),
        repeat({
          delay: () =>
            refresh$.pipe(
              mergeWith(this._conn.connection$), // While Reconnection
              debounceTime(200),
            ),
        }),
      )
      .subscribe();

    // Receive TerminalInfo from the channel
    defer(() =>
      this.channel.subscribeChannel<{ seq_id: number; type: string; payload?: unknown }>('HostEvent'),
    )
      .pipe(
        takeUntil(this.dispose$),
        tap((event) => {
          if (event.seq_id !== ack_seq_id + 1) {
            refresh$.next();
            return;
          }

          if (event.type === 'TERMINAL_CHANGE') {
            const payload = event.payload as { new?: ITerminalInfo; old?: ITerminalInfo };

            if (!payload.new && !payload.old) {
              // invalid payload
              refresh$.next();
              return;
            }

            if (payload.new && payload.old && payload.new.terminal_id !== payload.old.terminal_id) {
              // invalid payload
              refresh$.next();
              return;
            }

            const terminalId = payload.new ? payload.new.terminal_id : payload.old!.terminal_id;
            const variant = payload.new && payload.old ? 'UPDATE' : payload.new ? 'JOIN' : 'LEAVE';

            if (payload.old) {
              const oldTerminalId = payload.old.terminal_id;
              const oldIdx = this.terminalInfos.findIndex((x) => x.terminal_id === oldTerminalId);
              if (oldIdx !== -1) {
                this.terminalInfos.splice(oldIdx, 1);
              }
            }
            if (payload.new) {
              this.terminalInfos.push(payload.new);
            }
            this._terminalInfos$.next(this.terminalInfos);
            if (this.options.verbose) {
              console.info(
                formatTime(Date.now()),
                'Terminal',
                'HostEvent',
                `seq_id = ${event.seq_id}, type = ${
                  event.type
                }, variant = ${variant}, terminal_id = ${terminalId!}`,
              );
            }
            ack_seq_id = event.seq_id;
            return;
          }

          if (this.options.verbose) {
            console.info(
              formatTime(Date.now()),
              'Terminal',
              'HostEvent',
              `seq_id = ${event.seq_id}, type = ${event.type}`,
            );
          }
        }),
      )
      .subscribe();

    this.terminalInfoUpdated$
      .pipe(
        takeUntil(this.dispose$),
        debounceTime(10),
        tap(() => (this.terminalInfo.updated_at = Date.now())),
        tap(() => {
          if (this.options.verbose) {
            console.info(formatTime(Date.now()), 'Terminal', 'terminalInfo', 'pushing');
          }
        }),
        // request maybe failed, so we should retry until success or cancelled by new pushing action
        switchMap(() =>
          defer(() => this.client.request('UpdateTerminalInfo', '@host', this.terminalInfo)).pipe(
            tap((msg) => {
              if (this.options.verbose) {
                console.info(
                  formatTime(Date.now()),
                  'Terminal',
                  'terminalInfo',
                  'pushed',
                  msg.res?.code,
                  msg.trace_id,
                );
              }
            }),
            timeout(5000),
            retry({ delay: 1000 }),
          ),
        ),
      )
      .subscribe();

    // while reconnection
    from(this._conn.connection$).subscribe(() => {
      this.terminalInfoUpdated$.next();
    });

    // First Emit
    this.terminalInfoUpdated$.next();
  }

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
    this._conn.output$.complete(); // close the WS connection
    this._dispose$.next();
  }

  /**
   * Provide a service
   *
   * @deprecated - use `terminal.server.provideService` instead
   */
  provideService<TReq = {}, TRes = void, TFrame = void>(
    method: string,
    requestSchema: JSONSchema7,
    handler: IServiceHandler<TReq, TRes, TFrame>,
    options?: IServiceOptions,
  ): { dispose: () => void } {
    return this.server.provideService<TReq, TRes, TFrame>(method, requestSchema, handler, options);
  }

  private _setupDebugLog = () => {
    this._input$.pipe(takeUntil(this.dispose$)).subscribe((msg) => {
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
    this._output$.pipe(takeUntil(this.dispose$)).subscribe((msg) => {
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
  };

  private _setupPredefinedServerHandlers = () => {
    this.server.provideService('Ping', {}, () => [{ res: { code: 0, message: 'Pong' } }]);

    if (!this.options.disableMetrics) {
      this.server.provideService<{}, { metrics: string }>(
        'Metrics',
        { type: 'object', properties: { terminal_id: { type: 'string', const: this.terminal_id } } },
        async () => {
          const metrics = await MetricsExporter.export();
          return {
            res: {
              code: 0,
              message: 'OK',
              data: { metrics: `${PromRegistry.metrics()}\n${metrics}` },
            },
          };
        },
      );
    }

    if (isNode) {
      // Setup Process Metrics
      interval(5000)
        .pipe(
          takeUntil(this.dispose$),
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
        .subscribe();

      // Setup File System Stats
      interval(60_000)
        .pipe(
          takeUntil(this.dispose$),
          switchMap(async () => {
            const fs = await import('fs/promises');
            const stat = await fs.statfs(process.cwd());
            for (const key in stat) {
              MetricsProcessFileSystemStat.record(stat[key as keyof typeof stat], {
                type: key,
                terminal_id: this.terminal_id,
              });
            }
          }),
        )
        .subscribe();

      if (!this.options.disableTerminate) {
        this.server.provideService('Terminate', {}, function* () {
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
