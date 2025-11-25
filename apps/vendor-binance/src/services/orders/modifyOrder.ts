import { IActionHandlerOfModifyOrder } from '@yuants/data-order';
import { isApiError } from '../../api/client';
import { ICredential, postSpotOrderCancelReplace, putUmOrder } from '../../api/private-api';
import {
  decodeFutureSymbol,
  decodeSpotSymbol,
  deriveClientOrderId,
  mapOrderDirectionToSide,
  mapOrderTypeToOrdType,
} from './order-utils';
import { newError } from '@yuants/utils/lib/error';
import { decodePath } from '@yuants/utils/lib/path';

const modifyUnifiedOrder: IActionHandlerOfModifyOrder<ICredential> = async (credential, order) => {
  const symbol = decodeFutureSymbol(order.product_id);
  const side = mapOrderDirectionToSide(order.order_direction);

  const res = await putUmOrder(credential, {
    symbol,
    side,
    orderId: order.order_id ? parseInt(order.order_id) : undefined,
    // origClientOrderId: order.client_order_id, // TODO: support client_order_id
    quantity: order.volume,
    price: order.price,
  });
  if (isApiError(res)) {
    throw new Error(`Binance modify unified order failed: ${res.code} ${res.msg}`);
  }
};

const modifySpotOrder: IActionHandlerOfModifyOrder<ICredential> = async (credential, order) => {
  const symbol = decodeSpotSymbol(order.product_id);
  const side = mapOrderDirectionToSide(order.order_direction);
  const type = mapOrderTypeToOrdType(order.order_type);
  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

  const params: Parameters<typeof postSpotOrderCancelReplace>[1] = {
    symbol,
    side,
    type,
    cancelReplaceMode: 'STOP_ON_FAILURE',
    cancelOrderId: order.order_id ? parseInt(order.order_id) : undefined,
    // cancelOrigClientOrderId: order.client_order_id, // TODO: support client_order_id
    newClientOrderId: deriveClientOrderId(order),
    quantity: order.volume,
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

  const res = await postSpotOrderCancelReplace(credential, params);
  if (isApiError(res)) {
    throw new Error(`Binance modify spot order failed: ${res.code} ${res.msg}`);
  }
};

export const modifyOrder: IActionHandlerOfModifyOrder<ICredential> = async (credential, order) => {
  const [, TYPE] = decodePath(order.product_id);

  if (TYPE === 'USDT-FUTURE') {
    return modifyUnifiedOrder(credential, order);
  }
  if (TYPE === 'SPOT') {
    return modifySpotOrder(credential, order);
  }

  throw newError('BINANCE_MODIFY_ORDER_UNSUPPORTED_PRODUCT_TYPE', { order });
};
