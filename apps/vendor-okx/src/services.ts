import { Terminal } from '@yuants/protocol';
import { akToAccountIdCache } from './account';
import { client$ } from './api';

const terminal = Terminal.fromNodeEnv();

client$.subscribe(async (client) => {
  const tradingAccountId = await akToAccountIdCache.query(client.auth.access_key).then((x) => x!.trading);
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
        const result = await client.postGridAlgoOrder(msg.req as any);
        return { res: { code: 0, message: 'OK', data: result } };
      }
      return { res: { code: 0, message: 'No Params' } };
    },
  );
});
