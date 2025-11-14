import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { deleteFutureOrders, postFutureOrders } from './api/private-api';
import { IGateCredential } from './api/types';
import { buildFutureOrderParams, buildGateErrorMessage, getSettleFromAccountId } from './order-utils';

const terminal = Terminal.fromNodeEnv();

type CredentialledOrder = IOrder & { credential: IGateCredential };

terminal.server.provideService<CredentialledOrder>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^gate/',
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
    try {
      const settle = getSettleFromAccountId(msg.req.account_id);
      const params = buildFutureOrderParams(msg.req);
      const res = await postFutureOrders(msg.req.credential, settle, params);
      if (res?.label || res?.message || res?.detail) {
        return { res: { code: 400, message: buildGateErrorMessage(res) } };
      }
      return { res: { code: 0, message: 'OK', data: { order_id: `${res?.id ?? res?.order_id ?? ''}` } } };
    } catch (error) {
      return { res: { code: 500, message: `${error}` } };
    }
  },
);

terminal.server.provideService<CredentialledOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^gate/',
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
    if (!msg.req.order_id) {
      return { res: { code: 400, message: 'order_id is required' } };
    }
    try {
      const settle = getSettleFromAccountId(msg.req.account_id);
      await deleteFutureOrders(msg.req.credential, settle, msg.req.order_id);
      return { res: { code: 0, message: 'OK' } };
    } catch (error) {
      return { res: { code: 500, message: `${error}` } };
    }
  },
);
