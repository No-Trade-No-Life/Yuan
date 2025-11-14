import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from './api/private-api';
import { handleSuperMarginOrder, handleSwapOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder & { credential: ICredential }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^huobi/',
      },
      credential: {
        type: 'object',
        required: ['access_key', 'secret_key'],
        properties: {
          access_key: { type: 'string' },
          secret_key: { type: 'string' },
        },
      },
    },
  },
  async (msg) => {
    if (/huobi\/(.*)\/swap/.test(msg.req.account_id)) {
      await handleSwapOrder(msg.req, msg.req.credential);
    } else if (/huobi\/(.*)\/super-margin/.test(msg.req.account_id)) {
      await handleSuperMarginOrder(msg.req, msg.req.credential);
    } else throw new Error(`Unsupported account_id: ${msg.req.account_id}`);
    return { res: { code: 0, message: 'OK' } };
  },
);
