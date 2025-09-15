import { Terminal } from '@yuants/protocol';
import { client } from './api';
import { defer, firstValueFrom } from 'rxjs';
import { tradingAccountInfo$ } from './account';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const tradingAccountInfo = await firstValueFrom(tradingAccountInfo$);
  terminal.server.provideService(
    'Grid/Algo-Order',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountInfo.account_id },
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
