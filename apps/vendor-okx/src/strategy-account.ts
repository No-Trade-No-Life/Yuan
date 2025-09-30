import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer, filter, first, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

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
      const [gridAlgoOrders] = await Promise.all([
        client.getGridOrdersAlgoPending({
          algoOrdType: 'contract_grid',
        }),
      ]);

      let totalEquity = 0;
      const positions: IPosition[] = [];

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

            // 历史提取金额不会从 investment, totalPnl 扣减
            // 计算净值需要通过仓位的名义价值和实际杠杆计算
            totalEquity += +position.notionalUsd / +gridAlgoOrders.data?.[index].actualLever;
          }
        });
      });

      return {
        money: {
          currency: 'USDT',
          equity: totalEquity,
          // TODO: 累计策略的可提取资金作为 free
          free: 0,
        },
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
