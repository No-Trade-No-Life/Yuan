import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { isApiError } from '../../api/client';
import { deleteSpotOrder, deleteUmOrder, ICredential } from '../../api/private-api';
import { decodeFutureSymbol, decodeSpotSymbol } from './order-utils';
import { decodePath, newError } from '@yuants/utils';

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
  const [, TYPE] = decodePath(order.product_id);
  if (TYPE === 'USDT-FUTURE') {
    return cancelUnifiedOrder(credential, order);
  }
  if (TYPE === 'SPOT') {
    return cancelSpotOrder(credential, order);
  }
  throw newError('BINANCE_CANCEL_ORDER_UNSUPPORTED_PRODUCT_TYPE', { order });
};
