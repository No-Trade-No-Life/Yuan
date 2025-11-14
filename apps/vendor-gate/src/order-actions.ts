import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { getDefaultCredential } from './api/client';
import { deleteFutureOrders, postFutureOrders } from './api/private-api';
import { getFutureAccountId } from './account';
import { buildFutureOrderParams, buildGateErrorMessage, getSettleFromAccountId } from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getFutureAccountId();
  const settle = getSettleFromAccountId(accountId);

  terminal.server.provideService<IOrder>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: accountId } },
    },
    async (msg) => {
      try {
        const params = buildFutureOrderParams(msg.req);
        const res = await postFutureOrders(credential, settle, params);
        if (res?.label || res?.message || res?.detail) {
          return { res: { code: 400, message: buildGateErrorMessage(res) } };
        }
        return { res: { code: 0, message: 'OK', data: { order_id: `${res?.id ?? res?.order_id ?? ''}` } } };
      } catch (error) {
        return { res: { code: 500, message: `${error}` } };
      }
    },
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: accountId } },
    },
    async (msg) => {
      if (!msg.req.order_id) {
        return { res: { code: 400, message: 'order_id is required' } };
      }
      try {
        await deleteFutureOrders(credential, settle, msg.req.order_id);
        return { res: { code: 0, message: 'OK' } };
      } catch (error) {
        return { res: { code: 500, message: `${error}` } };
      }
    },
  );
}).subscribe();
