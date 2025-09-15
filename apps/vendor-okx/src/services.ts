import { Terminal } from '@yuants/protocol';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

terminal.provideService('Grid/Algo-Order', {}, async (msg) => {
  if (msg.req) {
    const result = await client.postGridAlgoOrder(msg.req as any);
    return { res: { code: 0, message: 'OK', data: result } };
  }
  return { res: { code: 0, message: 'No Params' } };
});
