import { Terminal } from '@yuants/protocol';
import { defer, firstValueFrom } from 'rxjs';
import { tradingAccountId$ } from './account';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const tradingAccountId = await firstValueFrom(tradingAccountId$);
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
}).subscribe();
