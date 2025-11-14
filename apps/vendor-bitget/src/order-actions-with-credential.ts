import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { postFutureCancelOrder, postFuturePlaceOrder, type ICredential } from './api/private-api';
import { buildFutureOrderParams } from './order-utils';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder & { credential: ICredential }, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^bitget/',
      },
      credential: {
        type: 'object',
        required: ['access_key', 'secret_key', 'passphrase'],
        properties: {
          access_key: { type: 'string' },
          secret_key: { type: 'string' },
          passphrase: { type: 'string' },
        },
      },
    },
  },
  async (msg) => {
    const params = buildFutureOrderParams(msg.req);
    const res = await postFuturePlaceOrder(msg.req.credential, params);
    if (res.msg !== 'success') {
      return { res: { code: +res.code, message: '' + res.msg } };
    }
    return { res: { code: 0, message: 'OK', data: { order_id: res.data.orderId } } };
  },
);

terminal.server.provideService<IOrder & { credential: ICredential }>(
  'CancelOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^bitget/',
      },
      credential: {
        type: 'object',
        required: ['access_key', 'secret_key', 'passphrase'],
        properties: {
          access_key: { type: 'string' },
          secret_key: { type: 'string' },
          passphrase: { type: 'string' },
        },
      },
    },
  },
  async (msg) => {
    const [instType, instId] = decodePath(msg.req.product_id);
    const res = await postFutureCancelOrder(msg.req.credential, {
      symbol: instId,
      productType: instType,
      orderId: msg.req.order_id,
    });
    if (res.msg !== 'success') {
      return { res: { code: +res.code, message: '' + res.msg } };
    }
    return { res: { code: 0, message: 'OK' } };
  },
);
