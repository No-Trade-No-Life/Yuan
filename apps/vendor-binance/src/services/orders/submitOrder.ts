import { IActionHandlerOfSubmitOrder } from '@yuants/data-order';
import {
  mapOrderDirectionToSide,
  mapOrderDirectionToPositionSide,
  mapOrderTypeToOrdType,
  decodeFutureSymbol,
  deriveClientOrderId,
} from './order-utils';
import { ICredential, postUmOrder } from '../../api/private-api';
import { isApiError } from '../../api/client';

export const submitOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
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
    throw new Error(`Binance submitOrder failed: ${res.code} ${res.msg}`);
  }
  return { order_id: `${res.orderId}` };
};
