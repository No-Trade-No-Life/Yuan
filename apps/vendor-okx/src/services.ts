import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { getTradingAccountId } from './accountInfos/uid';
import { getDefaultCredential, postGridAlgoOrder } from './api/private-api';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const tradingAccountId = await getTradingAccountId(credential);

  type Request = Parameters<typeof postGridAlgoOrder>[1];

  terminal.server.provideService<Request, any>(
    'Grid/Algo-Order',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      if (msg.req) {
        msg.req.tag = process.env.BROKER_CODE;
        const result = await postGridAlgoOrder(credential, msg.req);
        return { res: { code: 0, message: 'OK', data: result } };
      }
      return { res: { code: 0, message: 'No Params' } };
    },
  );
}).subscribe();
