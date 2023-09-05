import { batchGroupBy, rateLimitMap, switchMapWithComplete } from '@yuants/utils';
import { isNode } from 'browser-or-node';
import {
  EMPTY,
  Observable,
  Subject,
  bufferCount,
  catchError,
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
  mergeAll,
  mergeMap,
  of,
  pairwise,
  repeat,
  retry,
  share,
  shareReplay,
  takeWhile,
  tap,
  timeout,
  timer,
  toArray,
} from 'rxjs';
import { v4 } from 'uuid';
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

const MetricSubmitOrderCount = PromRegistry.create('counter', 'account_submit_order_count');

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

/**
 * Terminal
 *
 * @public
 */
export class Terminal {
  terminalInfo: ITerminalInfo;
  _conn: IConnection<ITerminalMessage>;
  private _serviceHandlers: Record<string, IServiceHandler> = {};
  private _serviceConcurrent: Record<string, number> = {};
  private _serviceRateLimit: Record<
    string,
    | {
        count: number;
        period: number;
      }
    | undefined
  > = {};

  constructor(
    public HV_URL: string,
    public terminalInfoInput: Omit<ITerminalInfo, 'serviceInfo'>,
    connection?: IConnection<ITerminalMessage>,
  ) {
    this.terminalInfo = { ...terminalInfoInput, serviceInfo: {} };
    const url = new URL(HV_URL);

    const terminal_id = this.terminalInfo.terminal_id;
    url.searchParams.set('terminal_id', terminal_id); // make sure terminal_id is in the connection parameters
    this.HV_URL = url.toString();
    this._conn = connection || createConnectionJson(this.HV_URL);
    this.terminalInfo.services ??= [];
    this.setupDebugLog();
    this.setupServer();
    this.setupPredefinedServerHandlers();
    this.setupPredefinedMiddleware();

    this.terminalInfo.start_timestamp_in_ms ??= Date.now();
    this.terminalInfo.status ??= 'INIT';

    this.setupReportTerminalInfo();
  }

  request<T extends string>(
    method: T,
    target_terminal_id: string,
    req: T extends keyof IService ? IService[T]['req'] : ITerminalMessage['req'],
  ): Observable<T extends keyof IService ? Partial<IService[T]> & ITerminalMessage : ITerminalMessage> {
    const trace_id = v4();
    const msg: ITerminalMessage = {
      trace_id,
      method,
      target_terminal_id,
      source_terminal_id: this.terminalInfo.terminal_id,
      req,
    };
    return defer(() => {
      this._conn.output$.next(msg);
      return this._conn.input$.pipe(
        filter((m) => m.trace_id === trace_id),
        // complete immediately when res is received
        takeWhile((msg1) => msg1.res === undefined, true),
      );
    }).pipe(
      //
      timeout({
        first: 30000,
        each: 10000,
        meta: `request Timeout: method=${msg.method} target=${target_terminal_id}`,
      }),
      share(),
    ) as any;
  }

  private setupDebugLog = () => {
    this._conn.input$.subscribe((msg) => {
      TerminalReceiveMassageTotal.inc({
        //
        method: msg.method,
        target_terminal_id: msg.target_terminal_id,
        source_terminal_id: msg.source_terminal_id,
      });
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.debug(
          new Date(),
          'Terminal',
          'RX',
          msg.trace_id,
          msg.method,
          msg.res?.code ?? '',
          msg.res?.message ?? '',
        );
      }
    });
    this._conn.output$.subscribe((msg) => {
      TerminalTransmittedMessageTotal.inc({
        //
        method: msg.method,
        target_terminal_id: msg.target_terminal_id,
        source_terminal_id: msg.source_terminal_id,
      });
      if (globalThis.process?.env?.LOG_LEVEL === 'DEBUG') {
        console.debug(
          new Date(),
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

  private setupReportTerminalInfo = () => {
    // Periodically report the value of terminalInfo
    defer(() =>
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
  };

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
    this.terminalInfo.serviceInfo[method] = { method, schema: {} };
    this._serviceHandlers[method] = handler;
    this._serviceConcurrent[method] = concurrent;

    rateLimitConfig && (this._serviceRateLimit[method] = rateLimitConfig);
  };

  private setupServer = () => {
    this._conn.input$
      .pipe(
        filter((msg) => msg.frame === undefined && msg.res === undefined),
        groupBy((msg) => msg.method),
        mergeMap((group) => {
          const handler = this._serviceHandlers[group.key];
          const concurrency = this._serviceConcurrent[group.key];

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
            RequestReceivedTotal.inc({
              method: req.method,
              source_terminal_id: req.source_terminal_id,
              target_terminal_id: req.target_terminal_id,
            });

            postHandleAction$.pipe(first(({ req: req1 }) => req1 === req)).subscribe(({ req, res }) => {
              RequestDurationBucket.observe(Date.now() - tsStart, {
                method: req.method,
                source_terminal_id: req.source_terminal_id,
                target_terminal_id: req.target_terminal_id,
                code: res.res?.code ?? 520,
              });
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
                  this._serviceRateLimit[subGroup.key]!,
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
                  console.error(new Date(), `ServerError`, msg, err);
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
  };

  private setupPredefinedServerHandlers = () => {
    this.setupService('Ping', () => of({ res: { code: 0, message: 'Pong' } }));
    this.setupService('Metrics', () =>
      of({
        res: { code: 0, message: 'OK', data: { metrics: PromRegistry.metrics() } },
      }),
    );
    if (isNode) {
      this.setupService('Terminate', () => {
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
   * Middleware：SubmitOrderCount
   */
  private setupPredefinedMiddleware = () => {
    this._conn.input$
      .pipe(
        //
        filter((msg) => msg.frame === undefined && msg.res === undefined),
        filter((msg) => msg.method === 'SubmitOrder'),
        mergeMap((reqMsg) =>
          this._conn.output$.pipe(
            //
            filter((resMsg) => resMsg.res !== undefined),
            first((resMsg) => resMsg.trace_id === reqMsg.trace_id),
            tap((resMsg) => {
              const req = reqMsg.req as IOrder;
              MetricSubmitOrderCount.inc({
                terminal_id: this.terminalInfo.terminal_id,
                terminal_name: this.terminalInfo.name,
                account_id: req.account_id,
                code: resMsg.res!.code,
              });
            }),
          ),
        ),
      )
      .subscribe();
  };

  /**
   * Terminal List of the same host
   */
  terminalInfos$ = defer(() =>
    this.queryDataRecords<ITerminalInfo>(
      { type: 'terminal_info', options: { sort: [['tags.terminal_id', 1]] } },
      'MongoDB',
    ),
  ).pipe(
    // ISSUE: filter out terminals that have not been updated for a long time
    filter((x) => Date.now() - x.updated_at < 60_000),
    map((x) => x.origin),
    toArray(),
    timeout(60000),
    retry({ delay: 1000 }),
    repeat({ delay: 1000 }),
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
        this.queryProducts(
          {
            datasource_id,
          },
          'MongoDB',
        ),
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
              delayWhen(() =>
                this.updateDataRecords(
                  [
                    mapSubscriptionRelationToDataRecord({
                      channel_id: encodeChannelId('AccountInfo', account_id),
                      provider_terminal_id: terminal.terminal_id,
                      consumer_terminal_id: this.terminalInfo.terminal_id,
                    }),
                  ],
                  'MongoDB',
                ).pipe(
                  // ISSUE: delayWhen must return at least one data, otherwise the entire stream will end
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(), // subscribe success
        ),
      ).pipe(
        mergeMap(() => this.useFeed<IAccountInfo>(encodeChannelId('AccountInfo', account_id))),
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
              delayWhen(() =>
                this.updateDataRecords(
                  [
                    mapSubscriptionRelationToDataRecord({
                      channel_id: encodeChannelId('Period', datasource_id, product_id, period_in_sec),
                      provider_terminal_id: terminal.terminal_id,
                      consumer_terminal_id: this.terminalInfo.terminal_id,
                    }),
                  ],
                  'MongoDB',
                ).pipe(
                  //
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(),
        ),
      ).pipe(
        mergeMap(() =>
          this.useFeed<IPeriod>(encodeChannelId('Period', datasource_id, product_id, period_in_sec)),
        ),
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
              delayWhen(() =>
                this.updateDataRecords(
                  [
                    mapSubscriptionRelationToDataRecord({
                      channel_id: encodeChannelId('Tick', datasource_id, product_id),
                      provider_terminal_id: terminal.terminal_id,
                      consumer_terminal_id: this.terminalInfo.terminal_id,
                    }),
                  ],
                  'MongoDB',
                ).pipe(
                  //
                  concatWith(of(0)),
                ),
              ),
            ),
          ),
          first(),
        ),
      ).pipe(
        mergeMap(() => this.useFeed<ITick>(encodeChannelId('Tick', datasource_id, product_id))),
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
      trace_id: v4(),
      method: 'Feed',
      frame: { channel_id, data },
      source_terminal_id: this.terminalInfo.terminal_id,
      target_terminal_id,
    });
  };

  copyDataRecords = (req: ICopyDataRecordsRequest, target_terminal_id: string) =>
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

  queryDataRecords = <T>(req: IQueryDataRecordsRequest, target_terminal_id: string) =>
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

  updateDataRecords = (records: IDataRecord<any>[], target_terminal_id: string) =>
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

  removeDataRecords = (req: IRemoveDataRecordsRequest, target_terminal_id: string) =>
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

  queryHistoryOrders = (req: IQueryHistoryOrdersRequest, target_terminal_id: string) => {
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

  queryPeriods = (req: IQueryPeriodsRequest, target_terminal_id: string) => {
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
          map((dataRecord) => dataRecord.origin),
          toArray(),
        ),
      ),
    );
  };

  queryProducts = (req: IQueryProductsRequest, target_terminal_id: string) => {
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
    this.subscriptionSnapshotOfTick$
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
              console.info(new Date(), 'SubscriptionRelationUpdated', relation);
            }),
            switchMapWithComplete((relation) => {
              // Update service list
              if (!this.terminalInfo.services!.some((x) => x.datasource_id === relation.datasource_id)) {
                this.terminalInfo.services!.push({ datasource_id: relation.datasource_id });
              }
              const channel_id = encodeChannelId('Tick', relation.datasource_id, relation.product_id);
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
                    console.info(new Date(), 'tick subscription stopped', relation);
                  },
                  subscribe: () => {
                    console.info(new Date(), 'tick subscription started', relation);
                  },
                }),
              );
            }),
          ),
        ),
      )
      .subscribe();
  };

  /**
   * Provide a Period data stream, push to all subscriber terminals
   */
  providePeriods = (
    datasource_id: string,
    usePeriods: (product_id: string, period_in_sec: number) => Observable<IPeriod[]>,
  ) => {
    this.subscriptionSnapshotOfPeriod$
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
              console.info(new Date(), 'SubscriptionRelationUpdated', relation);
            }),
            switchMapWithComplete((relation) => {
              // Update service list
              if (!this.terminalInfo.services!.some((x) => x.datasource_id === relation.datasource_id)) {
                this.terminalInfo.services!.push({ datasource_id: relation.datasource_id });
              }
              const channel_id = encodeChannelId(
                'Period',
                relation.datasource_id,
                relation.product_id,
                relation.period_in_sec,
              );
              return usePeriods(relation.product_id, relation.period_in_sec).pipe(
                //
                mergeAll(),
                tap({
                  next: (period) => {
                    for (const target_terminal_id of relation.consumer_terminal_ids) {
                      this.feed(channel_id, period, target_terminal_id);
                    }
                  },
                  unsubscribe: () => {
                    console.info(new Date(), 'Period subscription ended', relation);
                  },
                  subscribe: () => {
                    console.info(new Date(), 'Period subscription started', relation);
                  },
                }),
              );
            }),
          ),
        ),
      )
      .subscribe();
  };

  /**
   * Provide a AccountInfo data stream, push to all subscriber terminals
   */
  provideAccountInfo = (accountInfo$: Observable<IAccountInfo>) => {
    // setup services
    accountInfo$.pipe(first()).subscribe((info) => {
      // if there is no service, add one
      if (!this.terminalInfo.services!.some((x) => x.account_id === info.account_id)) {
        this.terminalInfo.services!.push({ account_id: info.account_id });
      }
      const channel_id = encodeChannelId(`AccountInfo`, info.account_id);
      // push to all subscriber terminals
      accountInfo$.subscribe((accountInfo) => {
        this.subscriptionSnapshotOfAccountInfo$
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
      });

      // Metrics
      accountInfo$
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
    });
  };

  /**
   * Push history orders to all subscriber terminals
   */
  updateHistoryOrders = (orders: IOrder[], target_terminal_id: string) => {
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
  updatePeriods = (periods: IPeriod[], target_terminal_id: string) => {
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
  updateProducts = (products: IProduct[], target_terminal_id: string) => {
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
    this.queryDataRecords<ISubscriptionRelation>(
      { type: 'subscription_relation', tags: { provider_terminal_id: this.terminalInfo.terminal_id } },
      'MongoDB',
    ),
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
            of(decodeChannelId(relation.channel_id)).pipe(
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
            of(decodeChannelId(relation.channel_id)).pipe(
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
            of(decodeChannelId(relation.channel_id)).pipe(
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
                        consumer_terminal_ids: x,
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

const encodeChannelId = (...params: any[]) =>
  params.map((param) => `${param}`.replace(/\//g, '\\/')).join('/');

const decodeChannelId = (channel_id: string) =>
  channel_id.split(/(?<!\\)\//g).map((x) => x.replace(/\\\//g, '/'));
