import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from './api/private-api';
import { cancelOrder } from './orders/cancelOrder';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder & { credential: ICredential }, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^okx/',
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
    const order_id = await submitOrder(msg.req.credential, msg.req);
    return { res: { code: 0, message: 'OK', data: { order_id } } };
  },
);

terminal.server.provideService<IOrder & { credential: ICredential }>(
  'ModifyOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^okx/',
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
    await modifyOrder(msg.req.credential, msg.req);
    return { res: { code: 0, message: 'OK' } };
  },
);

terminal.server.provideService<IOrder & { credential: ICredential }>(
  'CancelOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^okx/',
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
    await cancelOrder(msg.req.credential, msg.req);
    return { res: { code: 0, message: 'OK' } };
  },
);
