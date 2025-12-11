import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { cancelOrder, getOrders, getPositions, modifyOrder, submitOrder } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { getCredentialBySecretId } from './credential';
import { polyfillOrders, polyfillPosition } from './position';

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
    positions.forEach((pos) => {
      pos.account_id = credential.credentialId;
    });
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
    if (!res.data) return { res };
    const orders = res.data;
    orders.forEach((order) => {
      order.account_id = credential.credentialId;
    });
    await polyfillOrders(orders);
    return { res: { code: 0, message: 'OK', data: orders } };
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
    const [order] = await polyfillOrders([msg.req.order]);
    const res = await submitOrder(terminal, credential.credential, order);
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
    const [order] = await polyfillOrders([msg.req.order]);
    const res = await modifyOrder(terminal, credential.credential, order);
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
    const [order] = await polyfillOrders([msg.req.order]);
    const res = await cancelOrder(terminal, credential.credential, order);
    return { res };
  },
);
