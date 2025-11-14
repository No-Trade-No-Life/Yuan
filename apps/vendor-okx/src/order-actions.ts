import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { defer } from 'rxjs';
import { getTradingAccountId } from './account';
import { getDefaultCredential } from './api/private-api';
import { cancelOrder } from './orders/cancelOrder';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

const credential = getDefaultCredential();

defer(async () => {
  const tradingAccountId = await getTradingAccountId();
  terminal.server.provideService<IOrder, { order_id?: string }>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      return { res: { code: 0, message: 'OK', data: await submitOrder(credential, msg.req) } };
    },
  );

  terminal.server.provideService<IOrder>(
    'ModifyOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      await modifyOrder(credential, msg.req);
      return { res: { code: 0, message: 'OK' } };
    },
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: tradingAccountId },
      },
    },
    async (msg) => {
      await cancelOrder(credential, msg.req);
      return { res: { code: 0, message: 'OK' } };
    },
  );
}).subscribe();
