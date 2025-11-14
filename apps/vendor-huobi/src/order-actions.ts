import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from './api/private-api';
import { handleSuperMarginOrder, handleSwapOrder } from './orders/submitOrder';

/**
 * 提供订单提交服务
 */
export const provideOrderSubmitService = (
  terminal: Terminal,
  swapAccountId: string,
  superMarginAccountId: string,
  credential: ICredential,
) => {
  terminal.server.provideService<IOrder>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          const: superMarginAccountId,
        },
      },
    },
    async (msg) => {
      await handleSuperMarginOrder(msg.req, credential);
      return { res: { code: 0, message: 'OK' } };
    },
  );
  terminal.server.provideService<IOrder>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          const: swapAccountId,
        },
      },
    },
    async (msg) => {
      await handleSwapOrder(msg.req, credential);
      return { res: { code: 0, message: 'OK' } };
    },
  );
};
