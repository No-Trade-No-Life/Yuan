import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { cancelOrder, getOrders, getPositions, modifyOrder, submitOrder } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { getCredentialBySecretId } from './credential';
import { polyfillPosition } from './position';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<{ secret_id: string; product_id?: string }, IPosition[]>(
  'VEX/GetPositions',
  {
    type: 'object',
    required: ['secret_id'],
    properties: {
      secret_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialBySecretId(msg.req.secret_id);
    const res = await getPositions(terminal, credential.credential, msg.req.product_id);
    if (!res.data) return { res };
    const positions = await polyfillPosition(res.data);
    return { res: { code: 0, message: 'OK', data: positions } };
  },
);

terminal.server.provideService<{ secret_id: string; product_id?: string }, IOrder[]>(
  'VEX/GetOrders',
  {
    type: 'object',
    required: ['secret_id'],
    properties: {
      secret_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialBySecretId(msg.req.secret_id);
    const res = await getOrders(terminal, credential.credential, msg.req.product_id);
    res.data?.forEach((order) => {
      order.account_id = credential.credentialId;
    });
    return { res };
  },
);

// 10. Proxy Orders
// SubmitOrder
terminal.server.provideService<{ order: IOrder; secret_id: string }, { order_id: string }>(
  'VEX/SubmitOrder',
  {
    type: 'object',
    required: ['order', 'secret_id'],
    properties: {
      order: { type: 'object' },
      secret_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialBySecretId(msg.req.secret_id);
    const res = await submitOrder(terminal, credential.credential, msg.req.order);
    return { res };
  },
);

// ModifyOrder
terminal.server.provideService<{ order: IOrder; secret_id: string }, void>(
  'VEX/ModifyOrder',
  {
    type: 'object',
    required: ['order', 'secret_id'],
    properties: {
      order: { type: 'object' },
      secret_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialBySecretId(msg.req.secret_id);
    const res = await modifyOrder(terminal, credential.credential, msg.req.order);
    return { res };
  },
);

// CancelOrder
terminal.server.provideService<{ order: IOrder; secret_id: string }, void>(
  'VEX/CancelOrder',
  {
    type: 'object',
    required: ['order', 'secret_id'],
    properties: {
      order: { type: 'object' },
      secret_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialBySecretId(msg.req.secret_id);
    const res = await cancelOrder(terminal, credential.credential, msg.req.order);
    return { res };
  },
);
