import { IActionHandlerOfSubmitOrder } from '@yuants/data-order';
import { isApiError } from '../../api/client';
import { ICredential, postSpotOrder, postUmOrder } from '../../api/private-api';
import {
  decodeFutureSymbol,
  decodeSpotSymbol,
  deriveClientOrderId,
  mapOrderDirectionToPositionSide,
  mapOrderDirectionToSide,
  mapOrderTypeToOrdType,
} from './order-utils';

const submitUnifiedOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const symbol = decodeFutureSymbol(order.product_id);
  if (!order.volume) {
    throw new Error('Binance submitOrder requires order.volume to be set');
  }
  const side = mapOrderDirectionToSide(order.order_direction);
  const positionSide = mapOrderDirectionToPositionSide(order.order_direction);
  const type = mapOrderTypeToOrdType(order.order_type);
  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;
  const reduceOnly =
    order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'true' : undefined;

  const res = await postUmOrder(credential, {
    symbol,
    side,
    positionSide,
    type,
    quantity: order.volume,
    price: order.price,
    timeInForce,
    reduceOnly,
    newClientOrderId: deriveClientOrderId(order),
  });
  if (isApiError(res)) {
    throw new Error(`Binance submit unified order failed: ${res.code} ${res.msg}`);
  }
  return { order_id: `${res.orderId}` };
};

const submitSpotOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const symbol = decodeSpotSymbol(order.product_id);
  if (!order.volume) {
    throw new Error('Binance submitOrder requires order.volume to be set');
  }
  const side = mapOrderDirectionToSide(order.order_direction);
  const type = mapOrderTypeToOrdType(order.order_type);
  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;
  const params: Parameters<typeof postSpotOrder>[1] = {
    symbol,
    side,
    type,
    quantity: order.volume,
    newClientOrderId: deriveClientOrderId(order),
  };
  if (type === 'LIMIT') {
    if (order.price === undefined) {
      throw new Error('Binance spot LIMIT order requires price');
    }
    params.price = order.price;
    params.timeInForce = timeInForce;
  }
  if (order.price !== undefined && type === 'MARKET') {
    params.price = order.price;
  }
  const res = await postSpotOrder(credential, params);
  if (isApiError(res)) {
    throw new Error(`Binance submit spot order failed: ${res.code} ${res.msg}`);
  }
  return { order_id: `${res.orderId}` };
};

export const submitOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  if (order.account_id.includes('/unified/')) {
    return submitUnifiedOrder(credential, order);
  }
  if (order.account_id.includes('/spot/')) {
    return submitSpotOrder(credential, order);
  }
  throw new Error(`Unsupported account_id for submitOrder: ${order.account_id}`);
};
