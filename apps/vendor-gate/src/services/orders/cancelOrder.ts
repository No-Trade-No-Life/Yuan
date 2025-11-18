import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { deleteFutureOrders, ICredential } from '../../api/private-api';

export const cancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('Missing order_id');
  }
  await deleteFutureOrders(credential, 'usdt', order.order_id);
};
