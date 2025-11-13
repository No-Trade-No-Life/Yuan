import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { getStrategyAccountId } from './account';
import { getStrategyAccountInfo } from './accountInfos';
import { getDefaultCredential, getGridPositions } from './api/private-api';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const strategyAccountId = await getStrategyAccountId();

  addAccountMarket(terminal, { account_id: strategyAccountId, market_id: 'OKX' });

  terminal.server.provideService<
    { account_id: string; algoId: string },
    Awaited<ReturnType<typeof getGridPositions>>
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
