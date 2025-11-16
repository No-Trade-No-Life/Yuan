import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { deleteFApiV1Order, ICredential } from '../../api/private-api';
import { decodePath } from '@yuants/utils';

export const handleCancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  const [, decodedSymbol] = decodePath(order.product_id);
  if (!decodedSymbol) {
    throw new Error(`Invalid product_id: unable to decode symbol from "${order.product_id}"`);
  }
  if (!order.order_id) {
    throw new Error('order_id is required for CancelOrder');
  }

  await deleteFApiV1Order(credential, {
    symbol: decodedSymbol,
    orderId: order.order_id,
  });
};
