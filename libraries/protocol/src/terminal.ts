import { UUID, decodePath, encodePath, formatTime } from '@yuants/data-model';
import { batchGroupBy, rateLimitMap, switchMapWithComplete } from '@yuants/utils';
import Ajv, { ValidateFunction } from 'ajv';
import { isNode } from 'browser-or-node';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  bufferCount,
  catchError,
  combineLatestWith,
  concatMap,
  concatWith,
  defer,
  delayWhen,
  distinct,
  distinctUntilChanged,
  filter,
  first,
  from,
  groupBy,
  interval,
  map,
  mergeMap,
  of,
  pairwise,
  repeat,
  retry,
  share,
  shareReplay,
  takeWhile,
  tap,
  throttleTime,
  timeout,
  timer,
  toArray,
} from 'rxjs';
import { IConnection, createConnectionJson } from './create-connection';
import {
  IAccountInfo,
  IDataRecord,
  IOrder,
  IPeriod,
  IProduct,
  ISubscriptionRelation,
  ITerminalInfo,
  ITick,
} from './model';
import { IService, ITerminalMessage } from './services';
import {
  ICopyDataRecordsRequest,
  IQueryDataRecordsRequest,
  IRemoveDataRecordsRequest,
} from './services/data-record';
import { PromRegistry } from './services/metrics';
import { IQueryHistoryOrdersRequest, IQueryPeriodsRequest, IQueryProductsRequest } from './services/pull';
import { mergeAccountInfoPositions } from './utils/account-info';

const TerminalReceiveMassageTotal = PromRegistry.create('counter', 'terminal_receive_message_total');
const TerminalTransmittedMessageTotal = PromRegistry.create('counter', 'terminal_transmitted_message_total');
const AccountInfoEquity = PromRegistry.create('gauge', 'account_info_equity');
const AccountInfoBalance = PromRegistry.create('gauge', 'account_info_balance');
const AccountInfoProfit = PromRegistry.create('gauge', 'account_info_profit');
const AccountInfoUsed = PromRegistry.create('gauge', 'account_info_used');
const AccountInfoFree = PromRegistry.create('gauge', 'account_info_free');
const AccountInfoPositionVolume = PromRegistry.create('gauge', 'account_info_position_volume');
const AccountInfoPositionPrice = PromRegistry.create('gauge', 'account_info_position_price');
const AccountInfoPositionClosablePrice = PromRegistry.create('gauge', 'account_info_position_closable_price');
const AccountInfoPositionFloatingProfit = PromRegistry.create(
  'gauge',
  'account_info_position_floating_profit',
);
const DatasourceQuoteAsk = PromRegistry.create('gauge', 'datasource_quote_ask');
const DatasourceQuoteBid = PromRegistry.create('gauge', 'datasource_quote_bid');

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

const loadBalancer = (arr: string[], seed: string): string | undefined => {
  const N = arr.length;
  if (N === 0) {
    return undefined;
  }
  // No need to balance workload
  if (N === 1) {
    return arr[0];
  }
  // Load Balance: Hash the trace_id to select a terminal
  let sum = 0;
  for (let i = seed.length - 1; i >= 0; i--) {
    // NOTE: trace_id UUID 0-9 (48-57) + a-f (97-102)
    const num = seed.charCodeAt(i);
    // num >>6 === 0 => num < 64 => 0-9 (48-57)
    // num >>6 !== 0 => num >= 64 => a-f (97-102)
    sum = ((sum << 4) + (num >> 6 ? num - 87 : num - 48)) % N;
  }
  return arr[sum];
};

/**
 * Terminal
 *
 * @public
 */
export class Terminal {
  _conn: IConnection<ITerminalMessage>;
  private _serviceHandlers: Record<string, IServiceHandler> = {};
  private _serviceOptions: Record<string, IServiceOptions> = {};

  constructor(
    public host_url: string,
    public terminalInfo: ITerminalInfo,
    connection?: IConnection<ITerminalMessage>,
  ) {
    this.terminalInfo = { ...terminalInfo, serviceInfo: {}, channelIdSchemas: [] };
    const url = new URL(host_url);

    const terminal_id = this.terminalInfo.terminal_id;
    url.searchParams.set('terminal_id', terminal_id); // make sure terminal_id is in the connection parameters
    this.host_url = url.toString();

    this._conn = connection || createConnectionJson(this.host_url);
    this.setupDebugLog();
    this.setupServer();
    this.setupPredefinedServerHandlers();

    this.terminalInfo.start_timestamp_in_ms ??= Date.now();
    this.terminalInfo.status ??= 'INIT';
    this.terminalInfo.services ??= [];

    this.setupReportTerminalInfo();
  }

  private _subscriptions: Subscription[] = [];

  dispose() {
    this._conn.output$.complete();
    this._subscriptions.forEach((sub) => sub.unsubscribe());
  }

  request<T extends string>(
    method: T,
    target_terminal_id: string | undefined,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    const trace_id = UUID();
    return defer(() => {
      if (target_terminal_id !== undefined) {
        return of(target_terminal_id);
      }
      return this.terminalInfos$.pipe(
        first(),
        mergeMap((x) => x),
        filter((terminalInfo) => {
          if (!terminalInfo.discriminator) return false;
          return new Ajv({ strict: false }).validate(terminalInfo.discriminator, { method, req });
        }),
        map((terminalInfo) => terminalInfo.terminal_id),
        toArray(),
        map((arr) => {
          const target = loadBalancer(arr, trace_id);
          if (!target) {
            throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
          }
          return target;
        }),
      );
    }).pipe(
      map(
        (target_terminal_id): ITerminalMessage => ({
          trace_id,
          method,
          target_terminal_id,
          source_terminal_id: this.terminalInfo.terminal_id,
          req,
        }),
      ),
      mergeMap(this._doRequest),
    );
  }

  provideService = <T extends string>(
    method: T,
    requestSchema: JSONSchema7,
    handler: IServiceHandler<T>,
    options?: IServiceOptions,
  ) => {
    //
    (this.terminalInfo.serviceInfo ??= {})[method] = { method, schema: requestSchema };
    this._serviceHandlers[method] = handler;
    this._serviceOptions[method] = options || {};
  };

  private _doRequest = (msg: ITerminalMessage): Observable<any> => {
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
  };

  requestService = <T extends string>(
    method: T,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> => {
    const trace_id = UUID();
    return defer(() => {
      return this.terminalInfos$.pipe(
        first(),
        mergeMap((x) => x),
        combineLatestWith(this._mapTerminalIdAndMethodToValidator$.pipe(first())),
        filter(([terminalInfo, map]) => map[terminalInfo.terminal_id]?.[method]?.(req)),
        map(([terminalInfo]) => terminalInfo.terminal_id),
        toArray(),
        map((arr) => {
          const target = loadBalancer(arr, trace_id);
          if (!target) {
            throw Error(`No terminal available for request: method=${method} req=${JSON.stringify(req)}`);
          }
          return target;
        }),
      );
    }).pipe(
      map(
        (target_terminal_id): ITerminalMessage => ({
          trace_id,
          method,
          target_terminal_id,
          source_terminal_id: this.terminalInfo.terminal_id,
          req,
        }),
      ),
      mergeMap(this._doRequest),
    );
  };

  private setupDebugLog = () => {
    const sub1 = this._conn.input$.subscribe((msg) => {
      if (msg.method) {
        TerminalReceiveMassageTotal.inc({
          //
          method: msg.method,
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
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
          //
          method: msg.method,
          target_terminal_id: msg.target_terminal_id,
          source_terminal_id: msg.source_terminal_id,
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

  private setupReportTerminalInfo = () => {
    // Periodically report the value of terminalInfo
    this._subscriptions.push(
      defer(() => {
        this.terminalInfo.updated_at = Date.now();
        return this.request('UpdateTerminalInfo', '@host', this.terminalInfo);
      })
        .pipe(
          //
          timeout(5000),
          retry({ delay: 1000 }),
          repeat({ delay: 5000 }),
        )
        .subscribe(),
    );
    // DEPRECATED: Use UpdateTerminalInfo instead
    const sub = defer(() =>
      this.updateDataRecords(
        [
          {
            id: this.terminalInfo.terminal_id,
            type: 'terminal_info',
            created_at: this.terminalInfo.start_timestamp_in_ms!,
            frozen_at: null,
            updated_at: Date.now(),
            tags: { terminal_id: this.terminalInfo.terminal_id },
            origin: this.terminalInfo,
          },
        ],
        'MongoDB',
      ),
    )
      .pipe(
        //
        timeout(5000),
        retry({ delay: 1000 }),
        repeat({ delay: 5000 }),
      )
      .subscribe();
    this._subscriptions.push(sub);
  };

  subscribeChannel = (provider_terminal_id: string, channel_id: string) => {
    // Assume that it's low frequency to subscribe a channel
    const channels = ((this.terminalInfo.subscriptions ??= {})[provider_terminal_id] ??= []);
    if (channels.includes(channel_id)) return;
    channels.push(channel_id);
  };

  unsubscribeChannel = (provider_terminal_id: string, channel_id: string) => {
    // Assume that it's low frequency to unsubscribe a channel
    if (!this.terminalInfo.subscriptions) return;
    const channels = this.terminalInfo.subscriptions[provider_terminal_id];
    if (!channels) return;
    const idx = channels.indexOf(channel_id);
    if (idx === -1) return;
    channels.splice(idx, 1);
    if (channels.length > 0) return;
    delete this.terminalInfo.subscriptions[provider_terminal_id];
    if (Object.keys(this.terminalInfo.subscriptions).length > 0) return;
    delete this.terminalInfo.subscriptions;
  };

  /**
   * @deprecated - Use provideService instead
   */
  setupService = <T extends string>(
    method: T,
    handler: IServiceHandler<T>,
    concurrent: number = Infinity,
    // Client Perspective Rate Limit, mainly for preventing DOS attack
    rateLimitConfig?: {
      count: number;
      period: number;
    },
  ) => {
    (this.terminalInfo.serviceInfo ??= {})[method] = { method, schema: {} };
    this._serviceHandlers[method] = handler;
    this._serviceOptions[method] = {
      concurrent,
      rateLimitConfig,
    };
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
                source_terminal_id: this.terminalInfo.terminal_id,
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
                    source_terminal_id: this.terminalInfo.terminal_id,
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

  provideChannel = <T>(channelIdSchema: JSONSchema7, handler: (channel_id: string) => Observable<T>) => {
    const validate = new Ajv({ strict: false }).compile(channelIdSchema);
    (this.terminalInfo.channelIdSchemas ??= []).push(channelIdSchema);

    // map terminalInfos to Record<channel_id, target_terminal_id[]>
    const mapChannelIdToTargetTerminalIds$ = this.terminalInfos$.pipe(
      mergeMap((x) =>
        from(x).pipe(
          mergeMap((terminalInfo) =>
            from(terminalInfo.subscriptions?.[this.terminalInfo.terminal_id] ?? []).pipe(
              filter((channel_id) => validate(channel_id)),
              map((channel_id) => ({ consumer_terminal_id: terminalInfo.terminal_id, channel_id })),
              groupBy((x) => x.channel_id),
              mergeMap((group) =>
                group.pipe(
                  map((x) => x.consumer_terminal_id),
                  toArray(),
                  map((arr) => [group.key, arr] as [string, string[]]),
                ),
              ),
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
                  source_terminal_id: this.terminalInfo.terminal_id,
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

  consumeChannel = <T>(channel_id: string): Observable<T> => {
    // candidate target_terminal_id list
    const candidates$ = this.terminalInfos$.pipe(
      mergeMap((x) =>
        from(x).pipe(
          filter(
            (terminalInfo) =>
              terminalInfo.channelIdSchemas?.some((schema) =>
                new Ajv({ strict: false }).validate(schema, channel_id),
              ) ?? false,
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
        this.unsubscribeChannel(provider_terminal_id, channel_id);
        provider_terminal_id = undefined;
      }
      if (
        (!provider_terminal_id && candidates.length > 0) ||
        (provider_terminal_id && candidates.length > 0 && !candidates.includes(provider_terminal_id))
      ) {
        provider_terminal_id = loadBalancer(candidates, UUID())!;
        this.subscribeChannel(provider_terminal_id, channel_id);
      }
    });
    this._subscriptions.push(sub);

    return this._conn.input$.pipe(
      filter((msg) => msg.channel_id === channel_id && msg.source_terminal_id === provider_terminal_id),
      map((msg) => msg.frame as T),
      share(),
    );
  };

  /**
   * Terminal List of the same host
   */
  terminalInfos$ = defer(() =>
    this.queryDataRecords<ITerminalInfo>(
      {
        type: 'terminal_info',
        options: { sort: [['tags.terminal_id', 1]] },
      },
      // ISSUE: Must specified the terminal_id
      // TODO: Extract terminalInfo router terminal later
      'MongoDB',
    ),
  ).pipe(
    // ISSUE: filter out terminals that have not been updated for a long time
    filter((x) => Date.now() - x.updated_at < 60_000),
    map((x) => x.origin),
    toArray(),
    timeout(60000),
    retry({ delay: 1000 }),
    // ISSUE: Storage workload
    repeat({ delay: 10000 }),
    shareReplay(1),
  );

  private _mapTerminalIdAndMethodToValidator$: Observable<Record<string, Record<string, ValidateFunction>>> =
    this.terminalInfos$.pipe(
      //
      throttleTime(30_000),
      mergeMap((x) =>
        from(x).pipe(
          mergeMap((terminalInfo) =>
            from(Object.entries(terminalInfo.serviceInfo || {})).pipe(
              map(([method, serviceInfo]): [string, ValidateFunction] => [
                method,
                new Ajv().compile(serviceInfo.schema),
              ]),
              toArray(),
              map((arr) => Object.fromEntries(arr)),
              map((mapMethodToValidator): [string, Record<string, ValidateFunction>] => [
                terminalInfo.terminal_id,
                mapMethodToValidator,
              ]),
            ),
          ),
          toArray(),
          map((arr) => Object.fromEntries(arr)),
        ),
      ),
      shareReplay(1),
    );

  /**
   * Account ID List of the same host
   */
  accountIds$ = this.terminalInfos$.pipe(
    mergeMap((terminals) =>
      from(terminals).pipe(
        mergeMap((terminal) => terminal.services || []),
        map((service) => service.account_id),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        distinct(),
        toArray(),
        map((arr) => arr.sort()),
      ),
    ),
    shareReplay(1),
  );

  /**
   * Data source ID List of the same host
   */
  datasourceIds$ = this.terminalInfos$.pipe(
    mergeMap((terminals) =>
      from(terminals).pipe(
        mergeMap((terminal) => terminal.services || []),
        map((service) => service.datasource_id),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        distinct(),
        toArray(),
        map((arr) => arr.sort()),
      ),
    ),
    shareReplay(1),
  );

  /**
   * use products
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

  useFeed = (() => {
    const hub: Record<string, Observable<any>> = {};
    return <T>(channel_id: string): Observable<T> =>
      (hub[channel_id] ??= defer(() =>
        this._conn.input$.pipe(
          filter((msg: any): msg is IService['Feed'] => msg.method === 'Feed'),
          filter((msg) => msg.frame.channel_id === channel_id),
          map((msg) => msg.frame.data as T),
          filter((v): v is Exclude<typeof v, undefined> => !!v),
          shareReplay(1),
        ),
      ));
  })();

  /**
   * use account info data stream
   */
  useAccountInfo = (() => {
    const hub: Record<string, Observable<IAccountInfo>> = {};

    return (account_id: string) =>
      (hub[account_id] ??= defer(() =>
        this.terminalInfos$.pipe(
          first(),
          mergeMap((x) => x),
          mergeMap((terminal) =>
            from(terminal.services || []).pipe(
              filter((service) => service.account_id === account_id),
              tap(() => {
                this.subscribeChannel(terminal.terminal_id, encodePath('AccountInfo', account_id));
              }),
              delayWhen(() =>
                this.updateDataRecords([
                  mapSubscriptionRelationToDataRecord({
                    channel_id: encodePath('AccountInfo', account_id),
                    provider_terminal_id: terminal.terminal_id,
                    consumer_terminal_id: this.terminalInfo.terminal_id,
                  }),
                ]).pipe(
                  // ISSUE: delayWhen must return at least one data, otherwise the entire stream will end
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(), // subscribe success
        ),
      ).pipe(
        mergeMap(() => this.useFeed<IAccountInfo>(encodePath('AccountInfo', account_id))),
        timeout(60000),
        retry({ delay: 5000 }),
        shareReplay(1),
      ));
  })();

  /**
   * use period data stream
   */
  usePeriod = (() => {
    const hub: Record<string, Observable<IPeriod>> = {};
    return (datasource_id: string, product_id: string, period_in_sec: number) =>
      (hub[[datasource_id, product_id, period_in_sec].join('\n')] ??= defer(() =>
        this.terminalInfos$.pipe(
          first(),
          mergeMap((x) => x),
          mergeMap((terminal) =>
            from(terminal.services || []).pipe(
              filter((service) => service.datasource_id === datasource_id),
              tap(() => {
                this.subscribeChannel(
                  terminal.terminal_id,
                  encodePath('Period', datasource_id, product_id, period_in_sec),
                );
              }),
              delayWhen(() =>
                this.updateDataRecords([
                  mapSubscriptionRelationToDataRecord({
                    channel_id: encodePath('Period', datasource_id, product_id, period_in_sec),
                    provider_terminal_id: terminal.terminal_id,
                    consumer_terminal_id: this.terminalInfo.terminal_id,
                  }),
                ]).pipe(
                  //
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(),
        ),
      ).pipe(
        mergeMap(() => this.useFeed<IPeriod>(encodePath('Period', datasource_id, product_id, period_in_sec))),
        timeout(60000),
        retry({ delay: 5000 }),
        shareReplay(1),
      ));
  })();

  /**
   * use tick data stream
   */
  useTick = (() => {
    const hub: Record<string, Observable<ITick>> = {};
    return (datasource_id: string, product_id: string) =>
      (hub[[datasource_id, product_id].join('\n')] ??= defer(() =>
        this.terminalInfos$.pipe(
          first(),
          mergeMap((x) => x),
          mergeMap((terminal) =>
            from(terminal.services || []).pipe(
              filter((service) => service.datasource_id === datasource_id),
              tap(() => {
                this.subscribeChannel(terminal.terminal_id, encodePath('Tick', datasource_id, product_id));
              }),
              delayWhen(() =>
                this.updateDataRecords([
                  mapSubscriptionRelationToDataRecord({
                    channel_id: encodePath('Tick', datasource_id, product_id),
                    provider_terminal_id: terminal.terminal_id,
                    consumer_terminal_id: this.terminalInfo.terminal_id,
                  }),
                ]).pipe(
                  //
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(),
        ),
      ).pipe(
        mergeMap(() => this.useFeed<ITick>(encodePath('Tick', datasource_id, product_id))),
        filter((v): v is Exclude<typeof v, undefined> => !!v),
        timeout(60000),
        retry({ delay: 5000 }),
        shareReplay(1),
      ));
  })();

  submitOrder = (order: IOrder) =>
    this.terminalInfos$.pipe(
      mergeMap((v) => v),
      mergeMap((info) =>
        from(info.services || []).pipe(
          filter((service) => service.account_id !== undefined && service.account_id === order.account_id),
          map(() => info.terminal_id),
        ),
      ),
      first(),

      mergeMap((target_terminal_id) => this.request('SubmitOrder', target_terminal_id, order)),
      map((msg) => msg.res),
    );

  modifyOrder = (order: IOrder) =>
    this.terminalInfos$.pipe(
      mergeMap((v) => v),
      mergeMap((info) =>
        from(info.services || []).pipe(
          filter((service) => service.account_id !== undefined && service.account_id === order.account_id),
          map(() => info.terminal_id),
        ),
      ),
      first(),

      mergeMap((target_terminal_id) => this.request('ModifyOrder', target_terminal_id, order)),
      map((msg) => msg.res),
    );

  cancelOrder = (order: IOrder) =>
    this.terminalInfos$.pipe(
      mergeMap((v) => v),
      mergeMap((info) =>
        from(info.services || []).pipe(
          filter((service) => service.account_id !== undefined && service.account_id === order.account_id),
          map(() => info.terminal_id),
        ),
      ),
      first(),

      mergeMap((target_terminal_id) => this.request('CancelOrder', target_terminal_id, order)),
      map((msg) => msg.res),
    );

  /**
   * Push a data frame into subscription data stream
   */
  feed = (channel_id: string, data: any, target_terminal_id: string) => {
    this._conn.output$.next({
      trace_id: UUID(),
      method: 'Feed',
      frame: { channel_id, data },
      source_terminal_id: this.terminalInfo.terminal_id,
      target_terminal_id,
    });
  };

  copyDataRecords = (req: ICopyDataRecordsRequest, target_terminal_id?: string) =>
    this.request('CopyDataRecords', target_terminal_id, req).pipe(
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

  queryDataRecords = <T>(req: IQueryDataRecordsRequest, target_terminal_id?: string) =>
    this.request('QueryDataRecords', target_terminal_id, req).pipe(
      mergeMap((msg) => {
        if (msg.frame) {
          return msg.frame as IDataRecord<T>[];
        }
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
        }
        return EMPTY;
      }),
    );

  updateDataRecords = (records: IDataRecord<any>[], target_terminal_id?: string) =>
    this.request('UpdateDataRecords', target_terminal_id, records).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
        }
        return EMPTY;
      }),
    );

  removeDataRecords = (req: IRemoveDataRecordsRequest, target_terminal_id?: string) =>
    this.request('RemoveDataRecords', target_terminal_id, req).pipe(
      mergeMap((msg) => {
        if (msg.res) {
          if (msg.res.code !== 0) {
            throw Error(`ServerError: ${msg.res.code}: ${msg.res.message}`);
          }
        }
        return EMPTY;
      }),
    );

  queryHistoryOrders = (req: IQueryHistoryOrdersRequest, target_terminal_id?: string) => {
    return of(0).pipe(
      //
      delayWhen(() => {
        if (req.pull_source) {
          return this.terminalInfos$
            .pipe(
              mergeMap((v) => v),
              mergeMap((info) =>
                from(info.services || []).pipe(
                  filter((service) => req.account_id !== undefined && service.account_id === req.account_id),
                  map(() => info.terminal_id),
                ),
              ),
              first(),
            )
            .pipe(
              mergeMap((target_terminal_id) => this.request('QueryHistoryOrders', target_terminal_id, req)),
              map((msg) => msg.res),
              filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
              map((res) => {
                if (res.code !== 0) {
                  throw new Error(res.message ?? 'UnknownError');
                }
                return res;
              }),
            );
        }
        return of(0);
      }),
      mergeMap(() =>
        this.queryDataRecords<IOrder>(
          {
            type: 'order',
            time_range: [(req.start_time_in_us ?? 0) / 1000, Date.now()],
            tags: { account_id: req.account_id },
          },
          target_terminal_id,
        ).pipe(
          //
          map((dataRecord) => dataRecord.origin),
          toArray(),
        ),
      ),
    );
  };

  queryPeriods = (req: IQueryPeriodsRequest, target_terminal_id?: string) => {
    return of(0).pipe(
      //
      delayWhen(() => {
        if (req.pull_source) {
          return this.terminalInfos$
            .pipe(
              mergeMap((v) => v),
              mergeMap((info) =>
                from(info.services || []).pipe(
                  filter(
                    (service) =>
                      req.datasource_id !== undefined && service.datasource_id === req.datasource_id,
                  ),
                  map(() => info.terminal_id),
                ),
              ),
              first(),
            )
            .pipe(
              mergeMap((target_terminal_id) => this.request('QueryPeriods', target_terminal_id, req)),
              map((msg) => msg.res),
              filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
              map((res) => {
                if (res.code !== 0) {
                  throw new Error(res.message ?? 'UnknownError');
                }
                return res;
              }),
            );
        }
        return of(0);
      }),
      mergeMap(() =>
        this.queryDataRecords<IPeriod>(
          {
            type: 'period',
            time_range: [
              (req.start_time_in_us ?? 0) / 1000,
              (req.end_time_in_us ?? Date.now() * 1000) / 1000,
            ],
            tags: {
              datasource_id: req.datasource_id,
              product_id: req.product_id,
              period_in_sec: '' + req.period_in_sec,
            },
          },
          target_terminal_id,
        ).pipe(
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
        ),
      ),
    );
  };

  queryProducts = (req: IQueryProductsRequest, target_terminal_id?: string) => {
    return of(0).pipe(
      //
      delayWhen(() => {
        if (req.pull_source) {
          return this.terminalInfos$
            .pipe(
              mergeMap((v) => v),
              mergeMap((info) =>
                from(info.services || []).pipe(
                  filter(
                    (service) =>
                      req.datasource_id !== undefined && service.datasource_id === req.datasource_id,
                  ),
                  map(() => info.terminal_id),
                ),
              ),
              first(),
            )
            .pipe(
              mergeMap((target_terminal_id) => this.request('QueryProducts', target_terminal_id, req)),
              map((msg) => msg.res),
              filter((v): v is Exclude<typeof v, undefined> => v !== undefined),
              map((res) => {
                if (res.code !== 0) {
                  throw new Error(res.message ?? 'UnknownError');
                }
                return res;
              }),
            );
        }
        return of(0);
      }),
      mergeMap(() =>
        this.queryDataRecords<IProduct>(
          {
            type: 'product',
            tags: {
              datasource_id: req.datasource_id!,
            },
          },
          target_terminal_id,
        ).pipe(
          map((dataRecord) => dataRecord.origin),
          toArray(),
        ),
      ),
    );
  };

  /**
   * Provide a Tick data stream, push to all subscriber terminals
   */
  provideTicks = (datasource_id: string, useTicks: (product_id: string) => Observable<ITick>) => {
    const sub = this.subscriptionSnapshotOfTick$
      .pipe(
        //
        mergeMap((relations) =>
          from(relations).pipe(
            //
            filter((relation) => relation.datasource_id === datasource_id),
            toArray(),
          ),
        ),
        batchGroupBy((relation) => `${relation.datasource_id}\n${relation.product_id}`),
        mergeMap((group) =>
          group.pipe(
            //
            distinctUntilChanged(
              (a, b) => a.consumer_terminal_ids.join(',') === b.consumer_terminal_ids.join(','),
            ),
            tap((relation) => {
              console.info(formatTime(Date.now()), 'SubscriptionRelationUpdated', relation);
            }),
            switchMapWithComplete((relation) => {
              // Update service list
              if (!this.terminalInfo.services!.some((x) => x.datasource_id === relation.datasource_id)) {
                this.terminalInfo.services!.push({ datasource_id: relation.datasource_id });
              }
              const channel_id = encodePath('Tick', relation.datasource_id, relation.product_id);
              return useTicks(relation.product_id).pipe(
                //
                tap({
                  next: (tick) => {
                    // multicast
                    for (const target_terminal_id of relation.consumer_terminal_ids) {
                      this.feed(channel_id, tick, target_terminal_id);
                    }
                    // metrics
                    if (tick.ask) {
                      DatasourceQuoteAsk.set(tick.ask, {
                        datasource_id: tick.datasource_id,
                        product_id: tick.product_id,
                      });
                    }
                    if (tick.bid) {
                      DatasourceQuoteBid.set(tick.bid, {
                        datasource_id: tick.datasource_id,
                        product_id: tick.product_id,
                      });
                    }
                  },
                  unsubscribe: () => {
                    console.info(formatTime(Date.now()), 'tick subscription stopped', relation);
                  },
                  subscribe: () => {
                    console.info(formatTime(Date.now()), 'tick subscription started', relation);
                  },
                }),
              );
            }),
          ),
        ),
      )
      .subscribe();
    this._subscriptions.push(sub);
  };

  /**
   * Provide a Period data stream, push to all subscriber terminals
   */
  providePeriods = (
    datasource_id: string,
    usePeriods: (product_id: string, period_in_sec: number) => Observable<IPeriod[]>,
  ) => {
    const sub = this.subscriptionSnapshotOfPeriod$
      .pipe(
        //
        mergeMap((relations) =>
          from(relations).pipe(
            //
            filter((relation) => relation.datasource_id === datasource_id),
            toArray(),
          ),
        ),
        batchGroupBy((relation) =>
          encodePath(relation.datasource_id, relation.product_id, relation.period_in_sec),
        ),
        mergeMap((group) =>
          group.pipe(
            //
            distinctUntilChanged(
              (a, b) => a.consumer_terminal_ids.join(',') === b.consumer_terminal_ids.join(','),
            ),
            tap((relation) => {
              console.info(formatTime(Date.now()), 'SubscriptionRelationUpdated', relation);
            }),
            switchMapWithComplete((relation) => {
              // Update service list
              if (!this.terminalInfo.services!.some((x) => x.datasource_id === relation.datasource_id)) {
                this.terminalInfo.services!.push({ datasource_id: relation.datasource_id });
              }
              const channel_id = encodePath(
                'Period',
                relation.datasource_id,
                relation.product_id,
                relation.period_in_sec,
              );
              return usePeriods(relation.product_id, relation.period_in_sec).pipe(
                //
                tap({
                  next: (periods) => {
                    for (const target_terminal_id of relation.consumer_terminal_ids) {
                      this.feed(channel_id, periods, target_terminal_id);
                    }
                  },
                  unsubscribe: () => {
                    console.info(formatTime(Date.now()), 'Period subscription ended', relation);
                  },
                  subscribe: () => {
                    console.info(formatTime(Date.now()), 'Period subscription started', relation);
                  },
                }),
              );
            }),
          ),
        ),
      )
      .subscribe();
    this._subscriptions.push(sub);
  };

  /**
   * Provide a AccountInfo data stream, push to all subscriber terminals
   */
  provideAccountInfo = (accountInfo$: Observable<IAccountInfo>) => {
    // setup services
    const sub = accountInfo$.pipe(first()).subscribe((info) => {
      // if there is no service, add one
      if (!this.terminalInfo.services!.some((x) => x.account_id === info.account_id)) {
        this.terminalInfo.services!.push({ account_id: info.account_id });
      }
      const channel_id = encodePath(`AccountInfo`, info.account_id);
      // push to all subscriber terminals
      const sub1 = accountInfo$.subscribe((accountInfo) => {
        const sub = this.subscriptionSnapshotOfAccountInfo$
          .pipe(
            //
            first(),
            mergeMap((relations) =>
              from(relations).pipe(
                //
                filter((relation) => relation.account_id === accountInfo.account_id),
                tap((relation) => {
                  // 推流
                  for (const target_terminal_id of relation.consumer_terminal_ids) {
                    this.feed(channel_id, accountInfo, target_terminal_id);
                  }
                }),
              ),
            ),
          )
          .subscribe();
        this._subscriptions.push(sub);
      });
      this._subscriptions.push(sub1);

      // Metrics
      const sub2 = accountInfo$
        .pipe(
          //
          mergeMap(mergeAccountInfoPositions),
          pairwise(),
        )
        .subscribe(([lastAccountInfo, accountInfo]) => {
          AccountInfoBalance.set(accountInfo.money.balance, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoEquity.set(accountInfo.money.equity, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoProfit.set(accountInfo.money.profit, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoUsed.set(accountInfo.money.used, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });
          AccountInfoFree.set(accountInfo.money.free, {
            account_id: accountInfo.account_id,
            currency: accountInfo.money.currency,
          });

          for (const position of lastAccountInfo.positions) {
            AccountInfoPositionVolume.reset({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionPrice.reset({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionClosablePrice.reset({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionFloatingProfit.reset({
              account_id: lastAccountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
          }

          for (const position of accountInfo.positions) {
            AccountInfoPositionVolume.set(position.volume || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionPrice.set(position.position_price || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionClosablePrice.set(position.closable_price || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
            AccountInfoPositionFloatingProfit.set(position.floating_profit || 0, {
              account_id: accountInfo.account_id,
              product_id: position.product_id,
              variant: position.variant.toString(),
            });
          }
        });
      this._subscriptions.push(sub2);
    });
  };

  /**
   * Push history orders to all subscriber terminals
   */
  updateHistoryOrders = (orders: IOrder[], target_terminal_id?: string) => {
    return from(orders).pipe(
      //
      map(mapOrderToDataRecord),
      bufferCount(2000),
      concatMap((records) => this.updateDataRecords(records, target_terminal_id)),
      toArray(),
    );
  };

  /**
   * Push history Periods to all subscriber terminals
   */
  updatePeriods = (periods: IPeriod[], target_terminal_id?: string) => {
    return from(periods).pipe(
      //
      map(mapPeriodToDataRecord),
      bufferCount(2000),
      concatMap((records) => this.updateDataRecords(records, target_terminal_id)),
      toArray(),
    );
  };

  /**
   * Push Products to all subscriber terminals
   */
  updateProducts = (products: IProduct[], target_terminal_id?: string) => {
    return from(products).pipe(
      //
      map(mapProductToDataRecord),
      bufferCount(2000),
      concatMap((records) => this.updateDataRecords(records, target_terminal_id)),
      toArray(),
    );
  };

  /**
   * Subscription snapshot of the same host
   */
  subscriptionSnapshot$ = defer(() =>
    this.queryDataRecords<ISubscriptionRelation>({
      type: 'subscription_relation',
      tags: { provider_terminal_id: this.terminalInfo.terminal_id },
    }),
  ).pipe(
    //
    map((x) => x.origin),
    toArray(),
    retry({ delay: 30000 }),
    repeat({ delay: 5000 }),
    shareReplay(1),
  );

  /**
   * Account ID subscription snapshot of the same host
   */
  subscriptionSnapshotOfAccountInfo$ = this.subscriptionSnapshot$.pipe(
    mergeMap((list) =>
      from(list)
        .pipe(
          mergeMap((relation) =>
            of(decodePath(relation.channel_id)).pipe(
              //
              filter(([type]) => type === 'AccountInfo'),
              map(([, account_id]) => ({
                account_id,
                consumer_terminal_id: relation.consumer_terminal_id,
              })),
            ),
          ),
        )
        .pipe(
          groupBy((x) => x.account_id),
          mergeMap((groupAccount) =>
            groupAccount.pipe(
              map((x) => x.consumer_terminal_id),
              toArray(),
              map((x) => ({ account_id: groupAccount.key, consumer_terminal_ids: x })),
            ),
          ),
          toArray(),
        ),
    ),
    shareReplay(1),
  );

  /**
   * Tick Subscription snapshot of the same host
   */
  subscriptionSnapshotOfTick$ = this.subscriptionSnapshot$.pipe(
    mergeMap((list) =>
      from(list)
        .pipe(
          mergeMap((relation) =>
            of(decodePath(relation.channel_id)).pipe(
              //
              filter(([type]) => type === 'Tick'),
              map(([, datasource_id, product_id]) => ({
                datasource_id,
                product_id,
                consumer_terminal_id: relation.consumer_terminal_id,
              })),
            ),
          ),
        )
        .pipe(
          groupBy((x) => x.datasource_id),
          mergeMap((groupDataSource) =>
            groupDataSource.pipe(
              groupBy((x) => x.product_id),
              mergeMap((groupProduct) =>
                groupProduct.pipe(
                  map((x) => x.consumer_terminal_id),
                  toArray(),
                  map((x) => ({
                    datasource_id: groupDataSource.key,
                    product_id: groupProduct.key,
                    consumer_terminal_ids: x,
                  })),
                ),
              ),
            ),
          ),
          toArray(),
        ),
    ),
    shareReplay(1),
  );

  /**
   * Period Subscription snapshot of the same host
   */
  subscriptionSnapshotOfPeriod$ = this.subscriptionSnapshot$.pipe(
    mergeMap((list) =>
      from(list)
        .pipe(
          mergeMap((relation) =>
            of(decodePath(relation.channel_id)).pipe(
              //
              filter(([type]) => type === 'Period'),
              map(([, datasource_id, product_id, period_in_sec]) => ({
                datasource_id,
                product_id,
                period_in_sec: +period_in_sec,
                consumer_terminal_id: relation.consumer_terminal_id,
              })),
            ),
          ),
        )
        .pipe(
          groupBy((x) => x.datasource_id),
          mergeMap((groupDatasource) =>
            groupDatasource.pipe(
              groupBy((x) => x.product_id),
              mergeMap((groupProduct) =>
                groupProduct.pipe(
                  groupBy((x) => x.period_in_sec),
                  mergeMap((groupPeriod) =>
                    groupPeriod.pipe(
                      map((x) => x.consumer_terminal_id),
                      toArray(),
                      map((x) => ({
                        datasource_id: groupDatasource.key,
                        product_id: groupProduct.key,
                        period_in_sec: groupPeriod.key,
                        consumer_terminal_ids: x.sort(),
                      })),
                    ),
                  ),
                ),
              ),
            ),
          ),

          toArray(),
        ),
    ),
    shareReplay(1),
  );
}

/**
 * Map order to data record
 * Consider the order as an instantaneous product
 * Can be safely cached
 */
const mapOrderToDataRecord = (order: IOrder): IDataRecord<IOrder> => ({
  id: `${order.account_id}/${order.exchange_order_id}`,
  type: `order`,
  created_at: order.timestamp_in_us! / 1000,
  updated_at: Date.now(),
  frozen_at: order.timestamp_in_us! / 1000,
  tags: {
    account_id: order.account_id,
    product_id: order.product_id,
    exchange_order_id: order.exchange_order_id!,
    type: order.type.toString(),
    direction: order.direction.toString(),
  },
  origin: order,
});

/**
 * Map Period to data record
 * Use the start time of the Period as the creation time of the data record, use the end time of the Period as the update time, and use the end time of the K-line as the freeze time
 * Can be safely cached
 */
const mapPeriodToDataRecord = (period: IPeriod): IDataRecord<IPeriod> => {
  const period_end_time = period.timestamp_in_us / 1000 + period.period_in_sec * 1000;
  return {
    id: `${period.datasource_id}/${period.product_id}/${period.period_in_sec}/${period.timestamp_in_us}`,
    type: `period`,
    created_at: period.timestamp_in_us / 1000,
    updated_at: Date.now(),
    frozen_at: period_end_time < Date.now() ? period_end_time : null,
    tags: {
      datasource_id: period.datasource_id,
      product_id: period.product_id,
      period_in_sec: '' + period.period_in_sec,
    },
    origin: period,
  };
};

/**
 * Map product to data record
 * The product may be updated
 * Cannot be safely cached
 */
const mapProductToDataRecord = (product: IProduct): IDataRecord<IProduct> => ({
  id: `${product.datasource_id}-${product.product_id}`,
  type: `product`,
  created_at: null,
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    datasource_id: product.datasource_id,
    product_id: product.product_id,
    base_currency: product.base_currency,
    ...(product.quoted_currency ? { quoted_currency: product.quoted_currency } : {}),
  },
  origin: product,
});

const mapSubscriptionRelationToDataRecord = (
  origin: ISubscriptionRelation,
): IDataRecord<ISubscriptionRelation> => ({
  id: `${origin.channel_id}/${origin.provider_terminal_id}/${origin.consumer_terminal_id}`,
  type: 'subscription_relation',
  created_at: null,
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    channel_id: origin.channel_id,
    provider_terminal_id: origin.provider_terminal_id,
    consumer_terminal_id: origin.consumer_terminal_id,
  },
  origin,
});
