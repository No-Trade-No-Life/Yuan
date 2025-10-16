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

  type InferPromise<T> = T extends Promise<infer U> ? U : T;

  terminal.server.provideService<
    { account_id: string; algoId: string },
    InferPromise<ReturnType<typeof client.getGridPositions>>
  >(
    `OKX/QueryGridPositions`,
    {
      required: ['account_id', 'algoId'],
      properties: {
        account_id: { type: 'string', const: strategyAccountId },
        algoId: { type: 'string' },
      },
    },
    async (msg) => {
      //
      return {
        res: {
          code: 0,
          message: 'OK',
          data: await client.getGridPositions({ algoOrdType: 'contract_grid', algoId: msg.req.algoId }),
        },
      };
    },
    {
      egress_token_capacity: 20,
      egress_token_refill_interval: 4000, // 每 4 秒恢复 20 个令牌 (双倍冗余限流)
    },
  );

  provideAccountInfoService(
    terminal,
    strategyAccountId,
    async () => {
      // TODO: 需要分页获取所有的网格订单 (每页 100 条)
      const [gridAlgoOrders] = await Promise.all([
        client.getGridOrdersAlgoPending({
          algoOrdType: 'contract_grid',
        }),
      ]);

      let totalEquity = 0;
      const positions: IPosition[] = [];

      const gridPositionsRes = await Promise.all(
        gridAlgoOrders.data.map((item) =>
          terminal.client.requestForResponseData<
            { account_id: string; algoId: string },
            InferPromise<ReturnType<typeof client.getGridPositions>>
          >('OKX/QueryGridPositions', {
            account_id: strategyAccountId,
            algoId: item.algoId,
          }),
        ),
      );

      gridPositionsRes.forEach((gridPositions, index) => {
        let positionValuation = 0;
        const leverage = +gridAlgoOrders.data?.[index].actualLever;
        gridPositions?.data?.forEach((position) => {
          if (+position.pos !== 0) {
            const directionRaw = gridAlgoOrders.data?.[index]?.direction ?? '';
            const direction = directionRaw ? directionRaw.toUpperCase() : 'LONG';
            positions.push({
              position_id: encodePath(position.algoId, position.instId),
              datasource_id: 'OKX',
              product_id: encodePath(position.instType, position.instId),
              direction,
              volume: Math.abs(+position.pos),
              free_volume: +position.pos,
              position_price: +position.avgPx,
              floating_profit: +position.upl,
              closable_price: +position.last,
              valuation: +position.notionalUsd,
            });
            positionValuation += +position.notionalUsd;
          }
        });
        if (leverage === 0) {
          // 实际杠杆为 0，说明没有持仓，直接把投资金额和累计盈亏算到净值里
          totalEquity += +gridAlgoOrders.data?.[index].investment + +gridAlgoOrders.data?.[index].totalPnl;
        } else {
          // 历史提取金额不会从 investment, totalPnl 扣减
          // 计算净值需要通过仓位的名义价值和实际杠杆计算
          totalEquity += positionValuation / leverage;
        }
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
