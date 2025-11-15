import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { getDefaultCredential, postGridAlgoOrder } from './api/private-api';
import { getTradingAccountId } from './accountInfos/uid';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const tradingAccountId = await getTradingAccountId(credential);

  terminal.server.provideService(
    'Grid/Algo-Order',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      if (msg.req) {
        const result = await postGridAlgoOrder(credential, msg.req as any);
        return { res: { code: 0, message: 'OK', data: result } };
      }
      return { res: { code: 0, message: 'No Params' } };
    },
  );
}).subscribe();
