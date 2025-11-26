import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { deleteFutureOrders, ICredential } from '../../api/private-api';
import { decodePath } from '@yuants/utils';

export const cancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('Missing order_id');
  }
  const [, TYPE] = decodePath(order.product_id);
  if (TYPE === 'FUTURE') {
    await deleteFutureOrders(credential, 'usdt', order.order_id);
  }
  throw new Error('Product type not support');
};
