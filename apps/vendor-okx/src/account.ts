import {
  addAccountMarket,
  IAccountInfo,
  IAccountMoney,
  IPosition,
  publishAccountInfo,
} from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { combineLatest, defer, filter, first, map, repeat, retry, shareReplay, withLatestFrom } from 'rxjs';
import { client } from './api';
import { mapProductIdToMarginProduct$, mapProductIdToUsdtSwapProduct$ } from './product';

const terminal = Terminal.fromNodeEnv();

export const accountPosition$ = defer(() => client.getAccountPositions({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const accountConfig$ = defer(() => client.getAccountConfig()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const subAccountUids$ = defer(() => client.getSubAccountList()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const accountUid$ = accountConfig$.pipe(
  map((x) => x.data[0].uid),
  filter((x) => !!x),
  shareReplay(1),
);

const accountBalance$ = defer(() => client.getAccountBalance({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const accountUsdtBalance$ = accountBalance$.pipe(
  map((x) => x.data[0]?.details.find((x) => x.ccy === 'USDT')),
  filter((x): x is Exclude<typeof x, undefined> => !!x),
  shareReplay(1),
);

const pendingOrders$ = defer(() => client.getTradeOrdersPending({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const marketIndexTickerUSDT$ = defer(() => client.getMarketIndexTicker({ quoteCcy: 'USDT' })).pipe(
  map((x) => {
    const mapInstIdToPrice = new Map<string, number>();
    x.data.forEach((inst) => mapInstIdToPrice.set(inst.instId, Number(inst.idxPx)));
    return mapInstIdToPrice;
  }),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const tradingAccountInfo$ = accountPosition$.pipe(
  withLatestFrom(
    accountUid$,
    accountBalance$,
    pendingOrders$,
    mapProductIdToUsdtSwapProduct$,
    mapProductIdToMarginProduct$,
    marketIndexTickerUSDT$,
  ),
  map(
    ([
      positionsApi,
      uid,
      balanceApi,
      orders,
      mapProductIdToUsdtSwapProduct,
      mapProductIdToMarginProduct,
      marketIndexTickerUSDT,
    ]): IAccountInfo => {
      const account_id = `okx/${uid}/trading`;
      const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
      const positions: IPosition[] = [];

      balanceApi.data[0]?.details.forEach((detail) => {
        if (detail.ccy === 'USDT') {
          const balance = +(detail.cashBal ?? 0);
          const free = Math.min(
            balance, // free should no more than balance if there is much profits
            +(detail.availEq ?? 0),
          );
          const equity = +(detail.eq ?? 0);
          const used = equity - free;
          const profit = equity - balance;
          money.equity += equity;
          money.balance += balance;
          money.used += used;
          money.free += free;
          money.profit += profit;
        } else {
          const volume = +(detail.cashBal ?? 0);
          const free_volume = Math.min(
            volume, // free should no more than balance if there is much profits
            +(detail.availEq ?? 0),
          );
          const closable_price = marketIndexTickerUSDT.get(detail.ccy + '-USDT') || 0;
          const delta_equity = volume * closable_price || 0;
          const delta_profit = +detail.totalPnl || 0;
          const delta_balance = delta_equity - delta_profit;
          const delta_used = delta_equity; // all used
          const delta_free = 0;

          const product_id = encodePath('SPOT', `${detail.ccy}-USDT`);
          positions.push({
            position_id: product_id,
            datasource_id: 'OKX',
            product_id: product_id,
            direction: 'LONG',
            volume: volume,
            free_volume: free_volume,
            position_price: +detail.accAvgPx,
            floating_profit: delta_profit,
            closable_price: closable_price,
            valuation: delta_equity,
          });

          money.equity += delta_equity;
          money.profit += delta_profit;
          money.balance += delta_balance;
          money.used += delta_used;
          money.free += delta_free;
        }
      });
      positionsApi.data.forEach((x) => {
        const direction =
          x.posSide === 'long' ? 'LONG' : x.posSide === 'short' ? 'SHORT' : +x.pos > 0 ? 'LONG' : 'SHORT';
        const volume = Math.abs(+x.pos);
        const product_id = encodePath(x.instType, x.instId);
        const closable_price = +x.last;
        const valuation =
          x.instType === 'SWAP'
            ? (mapProductIdToUsdtSwapProduct.get(product_id)?.value_scale ?? 1) * volume * closable_price
            : x.instType === 'MARGIN'
            ? (mapProductIdToMarginProduct.get(product_id)?.value_scale ?? 1) * volume * closable_price
            : 0;

        positions.push({
          position_id: x.posId,
          datasource_id: 'OKX',
          product_id,
          direction,
          volume: volume,
          free_volume: +x.availPos,
          closable_price,
          position_price: +x.avgPx,
          floating_profit: +x.upl,
          valuation,
        });
      });
      return {
        account_id: account_id,
        updated_at: Date.now(),
        money: money,
        currencies: [money],
        positions: positions,
        orders: orders.data.map((x): IOrder => {
          const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';

          const order_direction =
            x.side === 'buy'
              ? x.posSide === 'long'
                ? 'OPEN_LONG'
                : 'CLOSE_SHORT'
              : x.posSide === 'short'
              ? 'OPEN_SHORT'
              : 'CLOSE_LONG';
          return {
            order_id: x.ordId,
            account_id,
            product_id: encodePath(x.instType, x.instId),
            submit_at: +x.cTime,
            filled_at: +x.fillTime,
            order_type,
            order_direction,
            volume: +x.sz,
            traded_volume: +x.accFillSz,
            price: +x.px,
            traded_price: +x.avgPx,
          };
        }),
      };
    },
  ),
  shareReplay(1),
);

const sub = defer(() => accountUid$)
  .pipe(first())
  .subscribe((uid) => {
    publishAccountInfo(terminal, `okx/${uid}/trading`, tradingAccountInfo$);
    addAccountMarket(terminal, { account_id: `okx/${uid}/trading`, market_id: 'OKX' });
    publishAccountInfo(terminal, `okx/${uid}/funding/USDT`, fundingAccountInfo$);
    publishAccountInfo(terminal, `okx/${uid}/earning/USDT`, earningAccountInfo$);
  });
defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());

const assetBalance$ = defer(() => client.getAssetBalances({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const fundingAccountInfo$ = combineLatest([accountUid$, assetBalance$, marketIndexTickerUSDT$]).pipe(
  map(([uid, assetBalances, marketIndexTickerUSDT]): IAccountInfo => {
    const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
    const positions: IPosition[] = [];

    assetBalances.data.forEach((x) => {
      if (x.ccy === 'USDT') {
        money.equity += +x.bal;
        money.balance += +x.bal;
        money.free += +x.bal;
      } else {
        const price = marketIndexTickerUSDT.get(x.ccy + '-USDT') || 0;
        const productId = encodePath('SPOT', `${x.ccy}-USDT`);
        const valuation = price * +x.bal || 0;
        positions.push({
          datasource_id: 'OKX',
          position_id: productId,
          product_id: productId,
          direction: 'LONG',
          volume: +x.bal,
          free_volume: +x.bal,
          position_price: price,
          floating_profit: 0,
          closable_price: price,
          valuation: valuation,
        });

        money.equity += valuation;
        money.balance += valuation;
        money.used += valuation;
      }
    });

    return {
      account_id: `okx/${uid}/funding/USDT`,
      updated_at: Date.now(),
      money: money,
      currencies: [money],
      positions: positions,
      orders: [],
    };
  }),
  shareReplay(1),
);

const savingBalance$ = defer(() => client.getFinanceSavingsBalance({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const earningAccountInfo$ = combineLatest([accountUid$, savingBalance$]).pipe(
  map(([uid, offers]): IAccountInfo => {
    const equity = offers.data.filter((x) => x.ccy === 'USDT').reduce((acc, x) => acc + +x.amt, 0);
    const balance = equity;
    const free = equity;
    const used = 0;
    const profit = 0;

    const money: IAccountMoney = {
      currency: 'USDT',
      equity,
      balance,
      used,
      free,
      profit,
    };
    return {
      account_id: `okx/${uid}/earning/USDT`,
      updated_at: Date.now(),
      money: money,
      currencies: [money],
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);
