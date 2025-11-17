import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { isApiError } from '../../api/client';
import { deleteSpotOrder, deleteUmOrder, ICredential } from '../../api/private-api';
import { decodeFutureSymbol, decodeSpotSymbol } from './order-utils';

const cancelUnifiedOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('Binance cancelOrder requires order_id');
  }
  const symbol = decodeFutureSymbol(order.product_id);
  const res = await deleteUmOrder(credential, {
    symbol,
    orderId: order.order_id,
  });
  if (isApiError(res)) {
    throw new Error(`Binance cancel unified order failed: ${res.code} ${res.msg}`);
  }
};

const cancelSpotOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('Binance cancelOrder requires order_id');
  }
  const symbol = decodeSpotSymbol(order.product_id);
  const res = await deleteSpotOrder(credential, {
    symbol,
    orderId: order.order_id,
  });
  if (isApiError(res)) {
    throw new Error(`Binance cancel spot order failed: ${res.code} ${res.msg}`);
  }
};

export const cancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (order.account_id.includes('/unified/')) {
    return cancelUnifiedOrder(credential, order);
  }
  if (order.account_id.includes('/spot/')) {
    return cancelSpotOrder(credential, order);
  }
  throw new Error(`Unsupported account_id for cancelOrder: ${order.account_id}`);
};
