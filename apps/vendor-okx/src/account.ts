import {
  addAccountMarket,
  IAccountInfo,
  IAccountMoney,
  IPosition,
  provideAccountInfoService,
  publishAccountInfo,
} from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { combineLatest, defer, filter, first, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { client } from './api';
import { mapProductIdToMarginProduct$, mapProductIdToUsdtSwapProduct$ } from './product';

const terminal = Terminal.fromNodeEnv();

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

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const account_id = `okx/${uid}/trading`;
  terminal.server.provideService(
    'QueryPendingOrders',
    {
      required: ['account_id'],
      properties: { account_id: { type: 'string', const: account_id } },
    },
    async () => {
      const orders = await client.getTradeOrdersPending({});
      const data = orders.data.map((x): IOrder => {
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
      });
      return { res: { code: 0, message: 'OK', data } };
    },
  );
}).subscribe();

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

export const tradingAccountId$ = accountUid$.pipe(
  map((uid) => `okx/${uid}/trading`),
  shareReplay(1),
);

defer(async () => {
  const tradingAccountId = await firstValueFrom(tradingAccountId$);

  provideAccountInfoService(
    terminal,
    tradingAccountId,
    async () => {
      const [
        gridAlgoOrders,
        positionsApi,
        balanceApi,
        mapProductIdToUsdtSwapProduct,
        mapProductIdToMarginProduct,
        marketIndexTickerUSDT,
      ] = await Promise.all([
        client.getGridOrdersAlgoPending({
          algoOrdType: 'contract_grid',
        }),
        client.getAccountPositions({}),
        client.getAccountBalance({}),
        firstValueFrom(mapProductIdToUsdtSwapProduct$),
        firstValueFrom(mapProductIdToMarginProduct$),
        firstValueFrom(marketIndexTickerUSDT$),
      ]);

      const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
      const positions: IPosition[] = [];

      const gridPositionsRes = await Promise.all(
        gridAlgoOrders.data.map((item) =>
          client.getGridPositions({ algoOrdType: 'contract_grid', algoId: item.algoId }),
        ),
      );

      gridPositionsRes.forEach((gridPositions, index) => {
        gridPositions?.data?.map((position) => {
          if (+position.pos !== 0) {
            positions.push({
              position_id: encodePath(position.algoId, position.instId),
              datasource_id: 'OKX',
              product_id: encodePath('contract_grid', position.instId),
              direction: gridAlgoOrders.data?.[index]?.direction.toUpperCase(),
              volume: +position.pos,
              free_volume: +position.pos,
              position_price: +position.avgPx,
              floating_profit: +position.upl,
              closable_price: +position.last,
              valuation: +position.notionalUsd,
            });
          }
        });
      });

      balanceApi.data[0]?.details.forEach((detail) => {
        if (detail.ccy === 'USDT') {
          const balance = +(detail.cashBal ?? 0) + +(detail.stgyEq ?? 0);
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
        money: money,
        positions: positions,
      };
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();

const sub = defer(() => accountUid$)
  .pipe(first())
  .subscribe((uid) => {
    addAccountMarket(terminal, { account_id: `okx/${uid}/trading`, market_id: 'OKX' });
    publishAccountInfo(terminal, `okx/${uid}/funding/USDT`, fundingAccountInfo$);
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
      positions: positions,
    };
  }),
  shareReplay(1),
);

defer(async () => {
  const uid = await firstValueFrom(accountUid$);
  const earningAccountId = `okx/${uid}/earning/USDT`;
  provideAccountInfoService(
    terminal,
    earningAccountId,
    async () => {
      const offers = await client.getFinanceSavingsBalance({});
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
        money: money,
        positions: [],
      };
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();
