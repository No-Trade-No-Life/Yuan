import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { defaultPerpAccountId } from './account';
import { getDefaultCredential } from './api/types';
import { cancelOrderAction } from './order-actions/cancelOrder';
import { submitOrder } from './order-actions/submitOrder';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'product_id', 'order_type', 'order_direction', 'volume'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    return {
      res: {
        code: 0,
        message: 'OK',
        data: await submitOrder(credential, msg.req),
      },
    };
  },
);

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    await cancelOrderAction(credential, msg.req);
    return {
      res: {
        code: 0,
        message: 'OK',
      },
    };
  },
);
