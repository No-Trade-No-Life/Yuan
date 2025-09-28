import { provideAccountInfoService } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { FundingRate } from 'ccxt/js/src/base/types';
import { defer, firstValueFrom, from, lastValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { EXCHANGE_ID, ex } from './api';
import { mapProductIdToSymbol, mapSymbolToProductId, products$ } from './product';

const terminal = Terminal.fromNodeEnv();

(async () => {
  const PUBLIC_ONLY = process.env.PUBLIC_ONLY === 'true';
  const ACCOUNT_ID = process.env.ACCOUNT_ID!;
  const CURRENCY = process.env.CURRENCY || 'USDT';

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
    terminal.server.provideService(
      'QueryPendingOrders',
      { required: ['account_id'], properties: { account_id: { type: 'string', const: account_id } } },
      async () => {
        const _orders = await ex.fetchOpenOrders();
        const data = _orders.map(
          (order): IOrder => ({
            order_id: order.id,
            account_id: account_id,
            product_id: mapSymbolToProductId[order.symbol],
            order_type: order.type === 'limit' ? 'LIMIT' : 'MARKET',
            order_direction: order.side === 'sell' ? 'OPEN_SHORT' : 'OPEN_LONG',
            volume: order.amount,
            submit_at: order.timestamp,
            price: order.price,
            traded_volume: order.amount - order.remaining,
          }),
        );
        return { res: { code: 0, message: 'OK', data } };
      },
    );

    provideAccountInfoService(
      terminal,
      account_id,
      async () => {
        const balance = await ex.fetchBalance();
        const _positions = await ex.fetchPositions(undefined);
        const positions = _positions.map((position) => ({
          position_id: position.id!,
          product_id: mapSymbolToProductId[position.symbol],
          direction: position.side === 'long' ? 'LONG' : 'SHORT',
          volume: position.contracts || 0,
          free_volume: position.contracts || 0,
          position_price: position.entryPrice || 0,
          closable_price: position.markPrice || 0,
          floating_profit: position.unrealizedPnl || 0,
          valuation: 0, // TODO: calculate valuation
        }));

        const equity = +(balance[CURRENCY]?.total ?? 0);
        const free = +(balance[CURRENCY]?.free ?? 0);

        return { positions, money: { currency: CURRENCY, equity, free } };
      },
      { auto_refresh_interval: 1000 },
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
      async (msg) => {
        console.info(formatTime(Date.now()), `SubmitOrder`, JSON.stringify(msg.req));
        const { product_id, order_type, order_direction } = msg.req;
        const symbol = mapProductIdToSymbol[product_id];
        if (!symbol) {
          return { res: { code: 400, message: 'No such symbol' } };
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

        await ex.createOrder(symbol, ccxtType, ccxtSide, volume, price, {
          // ISSUE: okx hedge LONG/SHORT mode need to set 'posSide' to 'long' or 'short'.
          posSide: posSide,
        });

        return { res: { code: 0, message: 'OK' } };
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
      async (msg) => {
        console.info(formatTime(Date.now()), `CancelOrder`, JSON.stringify(msg.req));
        await ex.cancelOrder(msg.req.order_id!);
        return { res: { code: 0, message: 'OK' } };
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
      async (msg) => {
        console.info(formatTime(Date.now()), `ModifyOrder`, JSON.stringify(msg.req));
        const { product_id, order_type, order_direction } = msg.req;
        const symbol = mapProductIdToSymbol[product_id];
        if (!symbol) {
          return { res: { code: 400, message: 'No such symbol' } };
        }
        const ccxtType = order_type === 'MARKET' ? 'market' : 'limit';
        const ccxtSide =
          order_direction === 'OPEN_LONG' || order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell';
        await ex.editOrder(msg.req.order_id!, symbol, ccxtType, ccxtSide, msg.req.volume, msg.req.price);
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }
})();
