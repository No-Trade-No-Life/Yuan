import {
  IAccountInfo,
  IAccountMoney,
  IPosition,
  provideAccountInfoService,
  publishAccountInfo,
} from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { FundingRate } from 'ccxt/js/src/base/types';
import {
  combineLatest,
  defer,
  delayWhen,
  filter,
  first,
  firstValueFrom,
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
import { EXCHANGE_ID, ex } from './api';
import { mapProductIdToSymbol, mapSymbolToProductId, products$ } from './product';

const terminal = Terminal.fromNodeEnv();

(async () => {
  const PUBLIC_ONLY = process.env.PUBLIC_ONLY === 'true';
  const ACCOUNT_ID = process.env.ACCOUNT_ID!;
  const CURRENCY = process.env.CURRENCY || 'USDT';

  let accountInfoLock = false;

  if (EXCHANGE_ID === 'binance') {
    ex.options['warnOnFetchOpenOrdersWithoutSymbol'] = false;
    ex.options['defaultType'] = 'future';
  }

  let account_id: string = ACCOUNT_ID;
  if (!account_id && ex.has['fetchAccounts'] && !PUBLIC_ONLY) {
    const accounts = await lastValueFrom(from(ex.loadAccounts()));
    console.info(formatTime(Date.now()), 'loadAccounts', JSON.stringify(accounts));
    account_id = `CCXT/${EXCHANGE_ID}/${accounts[0]?.id}`;
    console.info(formatTime(Date.now()), 'resolve account', account_id);
  }

  await firstValueFrom(products$);

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
    return (
      ex.has['fetchFundingRate']
        ? defer(() => ex.fetchFundingRate(symbol))
        : defer(() => ex.fetchFundingRates([symbol])).pipe(
            //
            map((v: Record<string, FundingRate>) => v[symbol]),
          )
    ).pipe(
      //
      repeat({ delay: 10_000 }),
      retry({ delay: 5000 }),
      shareReplay(1),
    );
  });

  // provideTicks(terminal, EXCHANGE_ID, (product_id) => {
  //   console.info(formatTime(Date.now()), 'tick_stream', product_id);
  //   const symbol = mapProductIdToSymbol[product_id];
  //   if (!symbol) {
  //     console.info(formatTime(Date.now()), 'tick_stream', product_id, 'no such symbol');
  //     return EMPTY;
  //   }
  //   return (
  //     ex.has['watchTicker']
  //       ? defer(() => ex.watchTicker(symbol)).pipe(repeat())
  //       : defer(() => ex.fetchTicker(symbol)).pipe(
  //           //
  //           repeat({ delay: 1000 }),
  //         )
  //   ).pipe(
  //     combineLatestWith(useFundingRate(symbol)),
  //     map(([ticker, fundingRateObj]): ITick => {
  //       // console.info(
  //       //   formatTime(Date.now()),
  //       //   'tick_stream',
  //       //   JSON.stringify(ticker),
  //       //   JSON.stringify(fundingRateObj),
  //       // );
  //       const markPrice = (fundingRateObj.markPrice || ticker.last || ticker.close)!;
  //       // ISSUE: fundingTimestamp of bitmex might be a meaningless string
  //       let settlement_scheduled_at: number | undefined;
  //       if (!isNaN(Number(fundingRateObj.fundingTimestamp))) {
  //         settlement_scheduled_at = +fundingRateObj.fundingTimestamp!;
  //       }
  //       if (!isNaN(new Date(fundingRateObj.fundingDatetime!).getTime())) {
  //         settlement_scheduled_at = new Date(fundingRateObj.fundingDatetime!).getTime();
  //       }
  //       return {
  //         datasource_id: EXCHANGE_ID,
  //         product_id,
  //         updated_at: ticker.timestamp!,
  //         ask: ticker.ask,
  //         bid: ticker.bid,
  //         price: ticker.last || ticker.close,
  //         volume: ticker.baseVolume,
  //         interest_rate_for_long: -fundingRateObj.fundingRate!,
  //         interest_rate_for_short: fundingRateObj.fundingRate!,
  //         settlement_scheduled_at,
  //       };
  //     }),
  //     catchError((e) => {
  //       console.error(formatTime(Date.now()), 'tick_stream', product_id, e);
  //       throw e;
  //     }),
  //     retry(1000),
  //   );
  // });

  if (!PUBLIC_ONLY) {
    // NOTE: some exchange has the concept of funding account
    if (['okx'].includes(EXCHANGE_ID)) {
      provideAccountInfoService(
        terminal,
        `${account_id}/funding`,
        async () => {
          const balance = await ex.fetchBalance({ type: 'funding' });
          const okx_balance = balance[CURRENCY];
          const money: IAccountMoney = {
            currency: CURRENCY,
            balance: okx_balance.total!,
            free: okx_balance.free!,
            used: okx_balance.used!,
            equity: okx_balance.total!,
            profit: 0,
          };
          return {
            money: money,
            positions: [],
          };
        },
        { auto_refresh_interval: 1000 },
      );
    }

    const accountInfo$ = defer(() => of(0)).pipe(
      mergeMap(() => {
        const balance$ = (
          ex.has['watchBalance']
            ? defer(() => ex.watchBalance()).pipe(repeat())
            : defer(() => ex.fetchBalance()).pipe(repeat({ delay: 1000 }))
        ).pipe(
          //
          shareReplay(1),
        );
        const positions$ = defer(() => ex.fetchPositions(undefined))
          .pipe(
            //
            repeat({ delay: 1000 }),
          )
          .pipe(
            mergeMap((positions) =>
              from(positions).pipe(
                map((position): IPosition => {
                  return {
                    position_id: position.id!,
                    product_id: mapSymbolToProductId[position.symbol],
                    direction: position.side === 'long' ? 'LONG' : 'SHORT',
                    volume: position.contracts || 0,
                    free_volume: position.contracts || 0,
                    position_price: position.entryPrice || 0,
                    closable_price: position.markPrice || 0,
                    floating_profit: position.unrealizedPnl || 0,
                    valuation: 0, // TODO: calculate valuation
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
                  order_id: order.id,
                  account_id: account_id,
                  product_id: mapSymbolToProductId[order.symbol],
                  order_type: order.type === 'limit' ? 'LIMIT' : 'MARKET',
                  order_direction: order.side === 'sell' ? 'OPEN_SHORT' : 'OPEN_LONG',
                  volume: order.amount,
                  submit_at: order.timestamp,
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
            const money: IAccountMoney = {
              currency: CURRENCY,
              balance: equity - profit,
              free: +(balance[CURRENCY]?.free ?? 0),
              used: +(balance[CURRENCY]?.used ?? 0),
              equity: equity,
              profit,
            };
            return {
              updated_at: Date.now(),
              account_id: account_id,
              money: money,
              positions,
            };
          }),
        );
      }),
      timeout(30_000),
      tap({
        error: (e) => console.error(formatTime(Date.now()), 'accountInfo$', e),
        next: () => {
          if (accountInfoLock) {
            console.info(formatTime(Date.now()), 'accountInfo$ is locked');
          }
        },
      }),
      retry({ delay: 1000 }),
      shareReplay(1),
    );
    const getAccountNetVolume = (accountInfo: IAccountInfo, product_id: string) => {
      const netVolume = accountInfo.positions
        .filter((v) => v.product_id === product_id)
        .reduce((acc, cur) => acc + cur.volume * (cur.direction === 'LONG' ? 1 : -1), 0);
      return netVolume;
    };

    publishAccountInfo(
      terminal,
      account_id,
      accountInfo$.pipe(
        // stuck on submit order to prevent duplicated order
        filter(() => !accountInfoLock),
      ),
    );

    terminal.server.provideService<IOrder>(
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
        const { product_id, order_type, order_direction } = msg.req;
        const symbol = mapProductIdToSymbol[product_id];
        if (!symbol) {
          return of({ res: { code: 400, message: 'No such symbol' } });
        }
        const ccxtType = order_type === 'MARKET' ? 'market' : 'limit';
        const ccxtSide =
          order_direction === 'OPEN_LONG' || order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell';
        const volume = msg.req.volume;
        const price = msg.req.price;
        const posSide =
          order_direction === 'OPEN_LONG' || order_direction === 'CLOSE_LONG' ? 'long' : 'short';
        console.info(
          formatTime(Date.now()),
          'submit to ccxt',
          JSON.stringify({ symbol, ccxtType, ccxtSide, volume, price, posSide }),
        );
        // ISSUE: wait until the account info position update
        return defer(() => accountInfo$).pipe(
          //
          first(),
          mergeMap((last_account_info) =>
            from(
              ex.createOrder(symbol, ccxtType, ccxtSide, volume, price, {
                // ISSUE: okx hedge LONG/SHORT mode need to set 'posSide' to 'long' or 'short'.
                posSide: posSide,
              }),
            ).pipe(
              delayWhen((v) =>
                accountInfo$.pipe(
                  //
                  first(
                    (accountInfo) =>
                      getAccountNetVolume(last_account_info, product_id) !==
                      getAccountNetVolume(accountInfo, product_id),
                  ),
                ),
              ),
            ),
          ),
          map(() => {
            return { res: { code: 0, message: 'OK' } };
          }),
          tap({
            subscribe: () => {
              if (accountInfoLock) {
                throw new Error('accountInfo is locked');
              }
              accountInfoLock = true;
            },
            finalize: () => {
              accountInfoLock = false;
            },
          }),
        );
      },
    );

    terminal.server.provideService<IOrder>(
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
        return from(ex.cancelOrder(msg.req.order_id!)).pipe(
          map(() => {
            return { res: { code: 0, message: 'OK' } };
          }),
        );
      },
    );

    terminal.server.provideService<IOrder>(
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
        const { product_id, order_type, order_direction } = msg.req;
        const symbol = mapProductIdToSymbol[product_id];
        if (!symbol) {
          return of({ res: { code: 400, message: 'No such symbol' } });
        }
        const ccxtType = order_type === 'MARKET' ? 'market' : 'limit';
        const ccxtSide =
          order_direction === 'OPEN_LONG' || order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell';
        return from(
          ex.editOrder(msg.req.order_id!, symbol, ccxtType, ccxtSide, msg.req.volume, msg.req.price),
        ).pipe(
          map(() => {
            return { res: { code: 0, message: 'OK' } };
          }),
        );
      },
    );
  }
})();
