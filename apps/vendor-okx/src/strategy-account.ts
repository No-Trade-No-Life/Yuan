import { defer, filter, first, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { addAccountMarket, IAccountMoney, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { client } from './api';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

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

export const accountConfig$ = defer(() => client.getAccountConfig()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const accountUid$ = accountConfig$.pipe(
  map((x) => x.data[0].uid),
  filter((x) => !!x),
  shareReplay(1),
);

export const strategyAccountId$ = accountUid$.pipe(
  map((uid) => `okx/${uid}/strategy`),
  shareReplay(1),
);
defer(async () => {
  const strategyAccountId = await firstValueFrom(strategyAccountId$);

  provideAccountInfoService(
    terminal,
    strategyAccountId,
    async () => {
      const [gridAlgoOrders, marketIndexTickerUSDT] = await Promise.all([
        client.getGridOrdersAlgoPending({
          algoOrdType: 'contract_grid',
        }),
        firstValueFrom(marketIndexTickerUSDT$),
      ]);

      const money: IAccountMoney = { currency: 'USDT', equity: 0, balance: 0, used: 0, free: 0, profit: 0 };
      const positions: IPosition[] = [];

      const convertToUsdt = (amount: number, ccy: string | undefined) => {
        if (!amount) return 0;
        if (!ccy || ccy === 'USDT') return amount;
        const price = marketIndexTickerUSDT.get(`${ccy}-USDT`) || 0;
        return amount * price;
      };

      const gridPositionsRes = await Promise.all(
        gridAlgoOrders.data.map((item) =>
          client.getGridPositions({ algoOrdType: 'contract_grid', algoId: item.algoId }),
        ),
      );

      gridPositionsRes.forEach((gridPositions, index) => {
        gridPositions?.data?.forEach((position) => {
          if (+position.pos !== 0) {
            const directionRaw = gridAlgoOrders.data?.[index]?.direction ?? '';
            const direction = directionRaw ? directionRaw.toUpperCase() : 'LONG';
            positions.push({
              position_id: encodePath(position.algoId, position.instId),
              datasource_id: 'OKX',
              product_id: encodePath(position.instType, position.instId),
              direction,
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

      gridAlgoOrders.data.forEach((grid) => {
        const ccy = grid.tradeQuoteCcy || 'USDT';
        const investment = convertToUsdt(+grid.investment || 0, ccy);
        const totalPnl = convertToUsdt(+grid.totalPnl || 0, ccy);
        const free = convertToUsdt(+grid.availEq || 0, ccy);

        const equity = investment + totalPnl;
        const used = Math.max(equity - free, 0);

        money.balance += investment;
        money.profit += totalPnl;
        money.equity += equity;
        money.free += free;
        money.used += used;
      });

      return {
        money,
        positions,
      };
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();

const sub = defer(() => accountUid$)
  .pipe(first())
  .subscribe((uid) => {
    addAccountMarket(terminal, { account_id: `okx/${uid}/strategy`, market_id: 'OKX' });
  });
defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());
