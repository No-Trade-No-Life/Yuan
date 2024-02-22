import {
  IAccountInfo,
  IOrder,
  IPeriod,
  IPosition,
  IProduct,
  ITick,
  OrderDirection,
  OrderType,
  PositionVariant,
  formatTime,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import ccxt, { Exchange } from 'ccxt';
import {
  EMPTY,
  bufferCount,
  catchError,
  combineLatest,
  combineLatestWith,
  defer,
  delayWhen,
  expand,
  filter,
  from,
  lastValueFrom,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
  toArray,
} from 'rxjs';

(async () => {
  const EXCHANGE_ID = process.env.EXCHANGE_ID!;
  const ACCOUNT_ID = process.env.ACCOUNT_ID!;
  const CURRENCY = process.env.CURRENCY || 'USDT';
  const EARLIEST_TIMESTAMP = +(process.env.EARLIEST_TIMESTAMP || 1262304000000);

  const CCXT_PARAMS = {
    apiKey: process.env.API_KEY,
    secret: process.env.SECRET,
    password: process.env.PASSWORD,
    httpProxy: process.env.HTTP_PROXY,
    // options: { defaultType: 'swap' }
  };
  console.info(formatTime(Date.now()), 'init', EXCHANGE_ID, CCXT_PARAMS);
  // @ts-ignore
  const ex: Exchange = new ccxt[EXCHANGE_ID](CCXT_PARAMS);

  if (EXCHANGE_ID === 'binance') {
    ex.options['warnOnFetchOpenOrdersWithoutSymbol'] = false;
    ex.options['defaultType'] = 'future';
  }

  let account_id: string = ACCOUNT_ID;

  if (!account_id && ex.has['loadAccounts']) {
    const accounts = await lastValueFrom(from(ex.loadAccounts()));
    console.info(formatTime(Date.now()), 'loadAccounts', JSON.stringify(accounts));
    account_id = `CCXT/${EXCHANGE_ID}/${accounts[0]?.id}`;
    console.info(formatTime(Date.now()), 'resolve account', account_id);
  }

  const terminal_id = process.env.TERMINAL_ID || `CCXT-${EXCHANGE_ID}-${account_id}-${CURRENCY}`;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id,
    name: `CCXT`,
  });

  const accountInfo$ = defer(() => of(0)).pipe(
    mergeMap(() => {
      const balance$ = (
        ex.has['watchBalance']
          ? defer(() => ex.watchBalance())
          : defer(() => ex.fetchBalance()).pipe(repeat({ delay: 1000 }))
      ).pipe(
        //
        shareReplay(1),
      );
      const positions$ = (
        ex.has['watchPositions']
          ? defer(() => ex.watchPositions())
          : defer(() => ex.fetchPositions()).pipe(
              //
              repeat({ delay: 1000 }),
            )
      ).pipe(
        mergeMap((positions) =>
          from(positions).pipe(
            map((position): IPosition => {
              return {
                position_id: position.id!,
                product_id: mapSymbolToProductId[position.symbol],
                variant: position.side === 'long' ? PositionVariant.LONG : PositionVariant.SHORT,
                volume: position.contracts || 0,
                free_volume: position.contracts || 0,
                position_price: position.entryPrice || 0,
                closable_price: position.markPrice || 0,
                floating_profit: position.unrealizedPnl || 0,
              };
            }),
            toArray(),
          ),
        ),
        shareReplay(1),
      );
      const orders$ = from(ex.fetchOpenOrders()).pipe(
        repeat({ delay: 1000 }),
        mergeMap((orders) =>
          from(orders).pipe(
            map((order): IOrder => {
              return {
                exchange_order_id: order.id,
                client_order_id: order.id,
                account_id: account_id,
                product_id: mapSymbolToProductId[order.symbol],
                type: order.type === 'limit' ? OrderType.LIMIT : OrderType.MARKET,
                direction: order.side === 'sell' ? OrderDirection.OPEN_SHORT : OrderDirection.OPEN_LONG,
                volume: order.amount,
                timestamp_in_us: order.timestamp * 1000,
                price: order.price,
                traded_volume: order.amount - order.remaining,
              };
            }),
            toArray(),
          ),
        ),
        shareReplay(1),
      );
      return combineLatest([balance$, positions$, orders$]).pipe(
        //
        map(([balance, positions, orders]): IAccountInfo => {
          const profit = positions.reduce((acc, cur) => cur.floating_profit + acc, 0);
          const equity = +(balance[CURRENCY]?.total ?? 0);
          return {
            timestamp_in_us: Date.now() * 1000,
            account_id: account_id,
            money: {
              currency: CURRENCY,
              balance: equity - profit,
              free: +(balance[CURRENCY]?.free ?? 0),
              used: +(balance[CURRENCY]?.used ?? 0),
              equity: equity,
              profit,
            },
            positions,
            orders,
          };
        }),
      );
    }),
    timeout(30_000),
    tap({ error: (e) => console.error(formatTime(Date.now()), 'accountInfo$', e) }),
    retry({ delay: 1000 }),
    shareReplay(1),
  );

  terminal.provideAccountInfo(accountInfo$);

  const mapProductIdToSymbol: Record<string, string> = {};
  const mapSymbolToProductId: Record<string, string> = {};

  const products$ = defer(() => ex.loadMarkets()).pipe(
    mergeMap((markets) => Object.values(markets)),
    filter((market): market is Exclude<typeof market, undefined> => !!market),
    tap((market) => {
      console.info('Product-Symbol', market.id, market.symbol);
      mapProductIdToSymbol[market.id] = market.symbol;
      mapSymbolToProductId[market.symbol] = market.id;
    }),
    map(
      (market): IProduct => ({
        datasource_id: EXCHANGE_ID,
        product_id: market.id,
        base_currency: market.base,
        quote_currency: market.quote,
        value_scale: market.contractSize,
        volume_step: market.precision.amount || 1,
        price_step: market.precision.price || 1,
      }),
    ),
    toArray(),
    repeat({ delay: 86400_000 }),
    retry({ delay: 10_000 }),
    shareReplay(1),
  );

  products$
    .pipe(
      //
      mergeMap((products) => terminal.updateProducts(products)),
    )
    .subscribe();

  // const mapPeriodInSecToCCXTTimeframe: Record<number, string> = {
  //   1: '1s',
  //   60: '1m',
  //   180: '3m',
  //   300: '5m',
  //   900: '15m',
  //   1800: '30m',
  //   3600: '1h',
  //   7200: '2h',
  //   14400: '4h',
  //   21600: '6h',
  //   43200: '12h',
  //   86400: '1d',
  //   259200: '3d',
  //   604800: '1w',
  //   2592000: '1M'
  // };

  const mapPeriodInSecToCCXTTimeframe = (period_in_sec: number): string => {
    if (period_in_sec % 2592000 === 0) {
      return `${period_in_sec / 2592000}M`;
    }
    if (period_in_sec % 604800 === 0) {
      return `${period_in_sec / 604800}w`;
    }
    if (period_in_sec % 86400 === 0) {
      return `${period_in_sec / 86400}d`;
    }
    if (period_in_sec % 3600 === 0) {
      return `${period_in_sec / 3600}h`;
    }
    if (period_in_sec % 60 === 0) {
      return `${period_in_sec / 60}m`;
    }
    return `${period_in_sec}s`;
  };

  terminal.provideService(
    'CopyDataRecords',
    {
      required: ['tags'],
      properties: {
        tags: {
          type: 'object',
          required: ['datasource_id'],
          properties: {
            datasource_id: {
              const: EXCHANGE_ID,
            },
          },
        },
      },
    },
    (msg) => {
      console.info(formatTime(Date.now()), `CopyDataRecords`, JSON.stringify(msg.req));
      if (msg.req.type === 'period') {
        const product_id = msg.req.tags?.product_id!;
        const period_in_sec = +msg.req.tags?.period_in_sec!;
        const timeframe = mapPeriodInSecToCCXTTimeframe(period_in_sec);

        const [start_timestamp, end_timestamp] = msg.req.time_range || [
          Date.now() - period_in_sec * 1000 * 100,
          Date.now(),
        ];
        const timeInterval = period_in_sec * 1000 * 100;
        const start = Math.max(EARLIEST_TIMESTAMP, start_timestamp);

        if (product_id && period_in_sec && timeframe) {
          console.info(formatTime(Date.now()), `FetchOHLCVStarted`);
          return of({
            periods: [],
            // ISSUE: OKX 的接口语义为两侧开区间，因此需要 -1 以包含 start_time_in_us
            current_start_timestamp: start - 1,
            current_end_timestamp: start + timeInterval - 1,
          }).pipe(
            //
            tap(() => {
              console.info(formatTime(Date.now()), `RecursivelyFetchOHLCVStarted`);
            }),
            expand(({ current_start_timestamp, current_end_timestamp }) => {
              console.info(
                formatTime(Date.now()),
                `FetchOHLCVStarted`,
                `current_start_timestamp: ${current_start_timestamp}`,
                `current_end_timestamp: ${current_end_timestamp}`,
              );
              if (current_start_timestamp > end_timestamp) return EMPTY;
              return from(
                ex.fetchOHLCV(mapProductIdToSymbol[product_id], timeframe, current_start_timestamp, 100, {
                  until: current_end_timestamp,
                }),
              ).pipe(
                //
                retry({ delay: 10_000 }),
                tap((v) => {
                  console.info(formatTime(Date.now()), `FetchOHLCVFinished`, `total: ${v.length}`);
                }),
                mergeMap((x) => x),
                map(
                  ([t, o, h, l, c, vol]): IPeriod => ({
                    datasource_id: EXCHANGE_ID,
                    product_id,
                    period_in_sec,
                    start_at: t,
                    timestamp_in_us: t! * 1000,
                    open: o!,
                    high: h!,
                    low: l!,
                    close: c!,
                    volume: vol!,
                  }),
                ),
                toArray(),
                map((periods) => ({
                  periods,
                  current_start_timestamp: current_start_timestamp + timeInterval,
                  current_end_timestamp: current_end_timestamp + timeInterval,
                })),
              );
            }),
            mergeMap(({ periods }) => periods),
            bufferCount(2000),
            delayWhen((periods) => terminal.updatePeriods(periods)),
            map(() => ({ res: { code: 0, message: 'OK' } })),
          );
        }
      }
      return of({ res: { code: 400, message: 'Bad Request' } });
    },
  );

  const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: any[]) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  };

  const useFundingRate = memoize((symbol: string) => {
    return from(ex.fetchFundingRate(symbol)).pipe(
      repeat({ delay: 10_000 }),
      retry({ delay: 5000 }),
      shareReplay(1),
    );
  });

  terminal.provideTicks(EXCHANGE_ID, (product_id) => {
    console.info(formatTime(Date.now()), 'tick_stream', product_id);
    const symbol = mapProductIdToSymbol[product_id];
    if (!symbol) {
      console.info(formatTime(Date.now()), 'tick_stream', product_id, 'no such symbol');
      return EMPTY;
    }
    return (
      ex.has['watchTicker']
        ? defer(() => ex.watchTicker(symbol))
        : defer(() => ex.fetchTicker(symbol)).pipe(
            //
            repeat({ delay: 500 }),
          )
    ).pipe(
      combineLatestWith(useFundingRate(symbol)),
      map(([ticker, fundingRateObj]): ITick => {
        return {
          datasource_id: EXCHANGE_ID,
          product_id,
          updated_at: ticker.timestamp!,
          ask: ticker.ask,
          bid: ticker.bid,
          volume: ticker.baseVolume,
          interest_rate_for_long: -fundingRateObj.fundingRate! * ticker.ask!,
          interest_rate_for_short: fundingRateObj.fundingRate! * ticker.bid!,
          settlement_scheduled_at: fundingRateObj.fundingTimestamp,
        };
      }),
      catchError((e) => {
        console.error(formatTime(Date.now()), 'tick_stream', product_id, e);
        throw e;
      }),
      retry(1000),
    );
  });

  terminal.providePeriods(EXCHANGE_ID, (product_id, period_in_sec) => {
    console.info(formatTime(Date.now()), 'period_stream', product_id, period_in_sec);
    const timeframe = mapPeriodInSecToCCXTTimeframe(period_in_sec);
    const symbol = mapProductIdToSymbol[product_id];
    if (!symbol) {
      return of([]);
    }
    return (
      ex.has['watchOHLCV']
        ? defer(() => ex.watchOHLCV(symbol, timeframe))
        : defer(() => {
            const since = Date.now() - 3 * period_in_sec * 1000;
            return ex.fetchOHLCV(symbol, timeframe, since);
          }).pipe(
            //
            repeat({ delay: 1000 }),
          )
    ).pipe(
      mergeMap((x) =>
        from(x).pipe(
          map(
            ([t, o, h, l, c, vol]): IPeriod => ({
              datasource_id: EXCHANGE_ID,
              product_id,
              period_in_sec,
              timestamp_in_us: t! * 1000,
              start_at: t,
              open: o!,
              high: h!,
              low: l!,
              close: c!,
              volume: vol!,
            }),
          ),
          toArray(),
        ),
      ),
      retry({ delay: 1000 }),
    );
  });

  terminal.provideService(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          const: account_id,
        },
      },
    },
    (msg) => {
      console.info(formatTime(Date.now()), `SubmitOrder`, JSON.stringify(msg.req));
      const { product_id, type, direction } = msg.req;
      const symbol = mapProductIdToSymbol[product_id];
      if (!symbol) {
        return of({ res: { code: 400, message: 'No such symbol' } });
      }
      const ccxtType = type === OrderType.MARKET ? 'market' : 'limit';
      const ccxtSide =
        direction === OrderDirection.OPEN_LONG || direction === OrderDirection.CLOSE_SHORT ? 'buy' : 'sell';
      const volume = msg.req.volume;
      const price = msg.req.price;
      const posSide =
        direction === OrderDirection.OPEN_LONG || direction === OrderDirection.CLOSE_LONG ? 'long' : 'short';
      console.info(
        formatTime(Date.now()),
        'submit to ccxt',
        JSON.stringify({ symbol, ccxtType, ccxtSide, volume, price, posSide }),
      );
      return from(
        ex.createOrder(symbol, ccxtType, ccxtSide, volume, price, {
          // ISSUE: okx hedge LONG/SHORT mode need to set 'posSide' to 'long' or 'short'.
          posSide: posSide,
        }),
      ).pipe(
        map(() => {
          return { res: { code: 0, message: 'OK' } };
        }),
      );
    },
  );

  terminal.provideService(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          const: account_id,
        },
      },
    },
    (msg) => {
      console.info(formatTime(Date.now()), `CancelOrder`, JSON.stringify(msg.req));
      return from(ex.cancelOrder(msg.req.client_order_id)).pipe(
        map(() => {
          return { res: { code: 0, message: 'OK' } };
        }),
      );
    },
  );

  terminal.provideService(
    'ModifyOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          const: account_id,
        },
      },
    },
    (msg) => {
      console.info(formatTime(Date.now()), `ModifyOrder`, JSON.stringify(msg.req));
      const { client_order_id, product_id, type, direction } = msg.req;
      const symbol = mapProductIdToSymbol[product_id];
      if (!symbol) {
        return of({ res: { code: 400, message: 'No such symbol' } });
      }
      const ccxtType = type === OrderType.MARKET ? 'market' : 'limit';
      const ccxtSide =
        direction === OrderDirection.OPEN_LONG || direction === OrderDirection.CLOSE_SHORT ? 'buy' : 'sell';
      return from(
        ex.editOrder(client_order_id, symbol, ccxtType, ccxtSide, msg.req.volume, msg.req.price),
      ).pipe(
        map(() => {
          return { res: { code: 0, message: 'OK' } };
        }),
      );
    },
  );
})();
