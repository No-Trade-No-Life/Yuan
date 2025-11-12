import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { defer, filter, first, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';
import { getAccountConfig, getDefaultCredential, getGridPositions } from './api';
import { getStrategyAccountInfo } from './accountInfos';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

export const accountConfig$ = defer(() => getAccountConfig(credential)).pipe(
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
    InferPromise<ReturnType<typeof getGridPositions>>
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
          data: await getGridPositions(credential, { algoOrdType: 'contract_grid', algoId: msg.req.algoId }),
        },
      };
    },
    {
      egress_token_capacity: 20,
      egress_token_refill_interval: 4000, // 每 4 秒恢复 20 个令牌 (双倍冗余限流)
    },
  );

  provideAccountInfoService(terminal, strategyAccountId, () => getStrategyAccountInfo(credential), {
    auto_refresh_interval: 5000,
  });
}).subscribe();

const sub = defer(() => accountUid$)
  .pipe(first())
  .subscribe((uid) => {
    addAccountMarket(terminal, { account_id: `okx/${uid}/strategy`, market_id: 'OKX' });
  });
defer(() => terminal.dispose$).subscribe(() => sub.unsubscribe());
