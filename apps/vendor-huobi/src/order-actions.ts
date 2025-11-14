import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from './api/private-api';
import { submitOrder } from './orders/submitOrder';

/**
 * 提供订单提交服务
 */
export const provideOrderSubmitService = (
  terminal: Terminal,
  swapAccountId: string,
  superMarginAccountId: string,
  credential: ICredential,
) => {
  terminal.server.provideService<IOrder, { order_id: string }>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: {
          enum: [superMarginAccountId, swapAccountId],
        },
      },
    },
    async (msg) => {
      return { res: { code: 0, message: 'OK', data: await submitOrder(credential, msg.req) } };
    },
  );
};
