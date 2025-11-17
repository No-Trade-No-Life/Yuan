import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { ICredential, deleteUmOrder } from '../../api/private-api';
import { isApiError } from '../../api/client';
import { decodeFutureSymbol } from './order-utils';

export const cancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('Binance cancelOrder requires order_id');
  }
  const symbol = decodeFutureSymbol(order.product_id);
  const res = await deleteUmOrder(credential, {
    symbol,
    orderId: order.order_id,
  });
  if (isApiError(res)) {
    throw new Error(`Binance cancelOrder failed: ${res.code} ${res.msg}`);
  }
};
