import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { cancelOrder, getOrders, getPositions, modifyOrder, submitOrder } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { getCredentialById } from './credential';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<{ credential_id: string; product_id?: string }, IPosition[]>(
  'VEX/GetPositions',
  {
    type: 'object',
    required: ['credential_id'],
    properties: {
      credential_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialById(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await getPositions(terminal, credential, msg.req.product_id);
    return { res };
  },
);

terminal.server.provideService<{ credential_id: string; product_id?: string }, IOrder[]>(
  'VEX/GetOrders',
  {
    type: 'object',
    required: ['credential_id'],
    properties: {
      credential_id: { type: 'string' },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialById(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await getOrders(terminal, credential, msg.req.product_id);
    res.data?.forEach((order) => {
      order.account_id = msg.req.credential_id;
    });
    return { res };
  },
);

// 10. Proxy Orders
// SubmitOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, { order_id: string }>(
  'VEX/SubmitOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialById(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await submitOrder(terminal, credential, msg.req.order);
    return { res };
  },
);

// ModifyOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, void>(
  'VEX/ModifyOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialById(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await modifyOrder(terminal, credential, msg.req.order);
    return { res };
  },
);

// CancelOrder
terminal.server.provideService<{ order: IOrder; credential_id: string }, void>(
  'VEX/CancelOrder',
  {
    type: 'object',
    required: ['order', 'credential_id'],
    properties: {
      order: { type: 'object' },
      credential_id: { type: 'string' },
    },
  },
  async (msg) => {
    const credential = await getCredentialById(msg.req.credential_id);
    if (!credential) {
      return { res: { code: 404, message: 'Credential not found' } };
    }
    const res = await cancelOrder(terminal, credential, msg.req.order);
    return { res };
  },
);
