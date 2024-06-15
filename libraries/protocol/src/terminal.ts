import {
  IAccountInfo,
  IDataRecord,
  IOrder,
  IPeriod,
  IProduct,
  ITick,
  UUID,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { rateLimitMap } from '@yuants/utils';
import Ajv, { ValidateFunction } from 'ajv';
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
  distinctUntilChanged,
  filter,
  first,
  firstValueFrom,
  from,
  groupBy,
  interval,
  map,
  mergeAll,
  mergeMap,
  of,
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
} from 'rxjs';
import { IConnection, createConnectionJson } from './create-connection';
import { ITerminalInfo } from './model';
import { IService, ITerminalMessage } from './services';
import {
  ICopyDataRecordsRequest,
  IQueryDataRecordsRequest,
  IRemoveDataRecordsRequest,
} from './services/data-record';
import { PromRegistry } from './services/metrics';
import { IQueryHistoryOrdersRequest, IQueryPeriodsRequest, IQueryProductsRequest } from './services/pull';
import {
  provideAccountInfo,
  providePeriods,
  provideTicks,
  readDataRecords,
  wrapOrder,
  wrapPeriod,
  wrapProduct,
  writeDataRecords,
} from './utils';

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
      output$: Subject<
        Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'> &
          Partial<Pick<IService[T], 'res' | 'frame'>>
      >,
    ) => Observable<
      Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'> &
        Partial<Pick<IService[T], 'res' | 'frame'>>
    >
  : // ISSUE: Allow custom methods between terminals
    (
      msg: ITerminalMessage,
      output$: Subject<
        Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'>
      >,
    ) => Observable<
      Omit<ITerminalMessage, 'method' | 'trace_id' | 'source_terminal_id' | 'target_terminal_id'>
    >;

interface IServiceOptions {
  concurrent?: number;
  rateLimitConfig?: {
    count: number;
    period: number;
  };
}

/**
 * Terminal
 *
 * @public
 */
export class Terminal {
  /**
   * Connection
   */
  _conn: IConnection<ITerminalMessage>;
  /**
   * Terminal ID
   */
  terminal_id: string;
  private _serviceHandlers: Record<string, IServiceHandler> = {};
  private _serviceOptions: Record<string, IServiceOptions> = {};

  private _terminalInfoUpdated$ = new Subject<void>();

  constructor(
    public host_url: string,
    public terminalInfo: ITerminalInfo,
    connection?: IConnection<ITerminalMessage>,
  ) {
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

    this._conn = connection || createConnectionJson(this.host_url);
    this.setupDebugLog();
    this.setupServer();
    this.setupPredefinedServerHandlers();
    this._setupChannelValidatorSubscription();
    this._setupTerminalIdAndMethodValidatorSubscription();

    this.terminalInfo.created_at = Date.now();
    this.terminalInfo.status ??= 'INIT';

    this._setupTerminalInfoStuff();
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
      this.consumeChannel<ITerminalInfo>('TerminalInfo')
        .pipe(
          mergeMap((x) =>
            this.terminalInfos$.pipe(
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
              retry({ delay: 1000 }),
            ),
          ),
        )
        .subscribe(() => {}),
    );

    // while reconnection
    this._conn.connection$.subscribe(() => {
      this._terminalInfoUpdated$.next();
    });

    // First Emit
    this._terminalInfoUpdated$.next();
  }

  private _subscriptions: Subscription[] = [];

  private _dispose$ = new Subject<void>();

  /**
   * Observable that emits when the terminal is disposed
   */
  dispose$: Observable<void> = this._dispose$.asObservable();

  /**
   * Dispose the terminal
   */
  dispose() {
    this._conn.output$.complete();
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
    const trace_id = UUID();
    const msg = {
      trace_id,
      method,
      target_terminal_id,
      source_terminal_id: this.terminal_id,
      req,
    };
    return defer((): Observable<any> => {
      this._conn.output$.next(msg);
      return this._conn.input$.pipe(
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
    });
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
      this.terminalInfos$.pipe(first()).pipe(
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
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> => {
    return defer(() => this.resolveTargetTerminalIds(method, req)).pipe(
      map((arr) => {
        if (arr.length === 0) {
          throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
        }
        const target = arr[~~(Math.random() * arr.length)]; // Simple Random Load Balancer
        return target;
      }),
      mergeMap((target_terminal_id) => this.request(method, target_terminal_id, req)),
    );
  };

  private setupDebugLog = () => {
    const sub1 = this._conn.input$.subscribe((msg) => {
      if (msg.method) {
        TerminalReceiveMassageTotal.inc({
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
          method: msg.method,
        });
      }
      if (msg.channel_id) {
        TerminalReceiveChannelMassageTotal.inc({
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
          channel_id: msg.channel_id,
        });
      }

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
    const sub2 = this._conn.output$.subscribe((msg) => {
      if (msg.method) {
        TerminalTransmittedMessageTotal.inc({
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
          method: msg.method,
        });
      }
      if (msg.channel_id) {
        TerminalTransmittedChannelMessageTotal.inc({
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
          channel_id: msg.channel_id,
        });
      }

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

  private setupServer = () => {
    const sub = this._conn.input$
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
              this._conn.output$.next({
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
              const res$: Observable<
                Omit<ITerminalMessage, 'trace_id' | 'method' | 'source_terminal_id' | 'target_terminal_id'>
              > = msg.res ? of(msg) : defer(() => handler(msg, output$));
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
        this._conn.output$.next(msg);
      });
    this._subscriptions.push(sub);
  };

  private setupPredefinedServerHandlers = () => {
    this.provideService('Ping', {}, () => of({ res: { code: 0, message: 'Pong' } }));

    this.provideService('Metrics', {}, () =>
      of({
        res: { code: 0, message: 'OK', data: { metrics: PromRegistry.metrics() } },
      }),
    );
    if (isNode) {
      this.provideService('Terminate', {}, () => {
        return of({ res: { code: 0, message: 'OK' } }).pipe(
          tap(() => {
            timer(1000)
              .pipe(
                tap(() => {
                  process.exit(0);
                }),
              )
              .subscribe();
          }),
        );
      });
    }
  };

  /**
   * Provide a channel
   * @param channelIdSchema - JSON Schema for channel_id
   * @param handler - handler for the channel, return an Observable to provide data stream
   */
  provideChannel = <T>(channelIdSchema: JSONSchema7, handler: (channel_id: string) => Observable<T>) => {
    const validate = new Ajv({ strict: false }).compile(channelIdSchema);
    (this.terminalInfo.channelIdSchemas ??= []).push(channelIdSchema);
    this._terminalInfoUpdated$.next();

    // map terminalInfos to Record<channel_id, target_terminal_id[]>
    const mapChannelIdToTargetTerminalIds$ = this.terminalInfos$.pipe(
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
          mapChannelIdToSubject[channel_id] = handler(channel_id);
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
                this._conn.output$.next({
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
      this.terminalInfos$
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
  consumeChannel = <T>(channel_id: string): Observable<T> =>
    // Cache by channel_id
    (this._mapChannelIdToSubject[channel_id] ??= new Observable<T>((subscriber) => {
      console.info(formatTime(Date.now()), 'Terminal', 'consumeChannel', 'subscribe', channel_id);
      // candidate target_terminal_id list
      const candidates$ = this.terminalInfos$.pipe(
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
      const sub1 = this._conn.input$
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
    ));

  private _terminalInfos$ = new ReplaySubject<ITerminalInfo[]>(1);
  /**
   * Terminal List of the same host
   */
  terminalInfos$: Observable<ITerminalInfo[]> = this._terminalInfos$.asObservable();

  // ISSUE: Ajv is very slow and cause a lot CPU utilization, so we must cache the compiled validator
  private _mapTerminalIdAndMethodToValidator: Record<string, Record<string, ValidateFunction>> = {};

  private _setupTerminalIdAndMethodValidatorSubscription() {
    this._subscriptions.push(
      this.terminalInfos$
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

  /**
   * use products
   *
   * @deprecated - use the util 'readDataRecords' instead
   */
  useProducts = (() => {
    const hub: Record<string, Observable<IProduct[]>> = {};
    return (datasource_id: string) =>
      (hub[datasource_id] ??= defer(() =>
        this.queryProducts({
          datasource_id,
        }),
      ).pipe(
        //
        timeout(60000),
        retry({ delay: 1000 }),
        repeat({ delay: 86400_000 }),
        shareReplay(1),
      ));
  })();

  /**
   * use account info data stream
   */
  useAccountInfo = (account_id: string) =>
    this.consumeChannel<IAccountInfo>(encodePath('AccountInfo', account_id));

  /**
   * use period data stream
   */
  usePeriod = (datasource_id: string, product_id: string, period_in_sec: number) =>
    this.consumeChannel<IPeriod[]>(encodePath('Period', datasource_id, product_id, period_in_sec));

  /**
   * use tick data stream
   */
  useTick = (datasource_id: string, product_id: string) =>
    this.consumeChannel<ITick>(encodePath('Tick', datasource_id, product_id));

  /**
   * @deprecated - use the method 'requestService' instead
   */
  submitOrder = (order: IOrder) =>
    this.requestService('SubmitOrder', order).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    );

  /**
   * @deprecated - use the method 'requestService' instead
   */
  modifyOrder = (order: IOrder) =>
    this.requestService('ModifyOrder', order).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    );

  /**
   * @deprecated - use the method 'requestService' instead
   */
  cancelOrder = (order: IOrder) =>
    this.requestService('CancelOrder', order).pipe(
      map((msg) => msg.res),
      filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
    );

  /**
   * @deprecated - use the method 'requestService' instead
   */
  copyDataRecords = (req: ICopyDataRecordsRequest) =>
    this.requestService('CopyDataRecords', req).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
          // emit an signal to indicate that the copy is complete
          return of(void 0);
        }
        return EMPTY;
      }),
    );

  /**
   * @deprecated - use the util 'readDataRecords' instead
   */
  queryDataRecords = <T>(req: IQueryDataRecordsRequest): Observable<IDataRecord<T>> =>
    readDataRecords(this, req as any).pipe(mergeMap((x) => x)) as any;

  /**
   * @deprecated - use the util 'writeDataRecords' instead
   */
  updateDataRecords = (records: IDataRecord<any>[]) => writeDataRecords(this, records);

  /**
   * @deprecated - use the util 'writeDataRecords' instead
   */
  removeDataRecords = (req: IRemoveDataRecordsRequest) =>
    this.requestService('RemoveDataRecords', req).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
        }
        return EMPTY;
      }),
    );

  /**
   * @deprecated - use the util 'readDataRecords' instead
   */
  queryHistoryOrders = (req: IQueryHistoryOrdersRequest) =>
    this.queryDataRecords<IOrder>({
      type: 'order',
      time_range: [(req.start_time_in_us ?? 0) / 1000, Date.now()],
      tags: { account_id: req.account_id },
    }).pipe(
      //
      map((dataRecord) => dataRecord.origin),
      toArray(),
    );

  /**
   * @deprecated - use the util 'readDataRecords' instead
   */
  queryPeriods = (req: IQueryPeriodsRequest) =>
    this.queryDataRecords<IPeriod>({
      type: 'period',
      time_range: [(req.start_time_in_us ?? 0) / 1000, (req.end_time_in_us ?? Date.now() * 1000) / 1000],
      tags: {
        datasource_id: req.datasource_id,
        product_id: req.product_id,
        period_in_sec: '' + req.period_in_sec,
      },
    }).pipe(
      // ISSUE: unknown reason, sometimes the data will be out of range, but frozen_at is null.
      filter((dataRecord) => {
        if (
          dataRecord.origin.timestamp_in_us + dataRecord.origin.period_in_sec * 1e6 <
          req.start_time_in_us
        ) {
          console.warn(formatTime(Date.now()), 'QueryPeriods', 'Dirty Data', JSON.stringify(dataRecord));
          return false;
        }
        return true;
      }),
      map((dataRecord) => dataRecord.origin),
      toArray(),
    );

  /**
   * @deprecated - use the util 'readDataRecords' instead
   */
  queryProducts = (req: IQueryProductsRequest) =>
    readDataRecords(this, { type: 'product', tags: { datasource_id: req.datasource_id! } }).pipe(
      mergeMap((x) => from(x).pipe(map((dataRecord) => dataRecord.origin))),
      toArray(),
    );

  /**
   * Provide a Tick data stream, push to all subscriber terminals
   * @deprecated - use the util 'provideTicks' instead
   */
  provideTicks = (datasource_id: string, useTicks: (product_id: string) => Observable<ITick>) => {
    provideTicks(this, datasource_id, useTicks);
  };

  /**
   * Provide a Period data stream, push to all subscriber terminals
   * @deprecated - use the util 'providePeriods' instead
   */
  providePeriods = (
    datasource_id: string,
    usePeriods: (product_id: string, period_in_sec: number) => Observable<IPeriod[]>,
  ) => {
    providePeriods(this, datasource_id, usePeriods);
  };

  /**
   * Provide a AccountInfo data stream, push to all subscriber terminals
   * @deprecated - use the util 'provideAccountInfo' instead
   */
  provideAccountInfo = (accountInfo$: Observable<IAccountInfo>) => {
    provideAccountInfo(this, accountInfo$);
  };

  /**
   * Push history orders to all subscriber terminals
   *
   * @deprecated - use the util 'writeDataRecords' instead
   */
  updateHistoryOrders = (orders: IOrder[]) => writeDataRecords(this, orders.map(wrapOrder));

  /**
   * Push history Periods to all subscriber terminals
   *
   * @deprecated - use the util 'writeDataRecords' instead
   */
  updatePeriods = (periods: IPeriod[]) => writeDataRecords(this, periods.map(wrapPeriod));

  /**
   * Push Products to all subscriber terminals
   *
   * @deprecated - use the util 'writeDataRecords' instead
   */
  updateProducts = (products: IProduct[]) => writeDataRecords(this, products.map(wrapProduct));
}
