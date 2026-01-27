import { IActionHandlerOfSubmitOrder } from '@yuants/data-order';
import { decodePath, newError } from '@yuants/utils';
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
import { fetchTradeHistory } from '../trade-history';

const submitUnifiedOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const symbol = decodeFutureSymbol(order.product_id);
  if (!order.volume) {
    throw new Error('Binance submitOrder requires order.volume to be set');
  }
  // 单向持仓模式 (single side mode) 下
  const isSingleSideMode = false; // TODO: fetch from account info API and cache it
  const side = mapOrderDirectionToSide(order.order_direction);
  const positionSide = isSingleSideMode ? undefined : mapOrderDirectionToPositionSide(order.order_direction);
  const type = mapOrderTypeToOrdType(order.order_type);
  const timeInForce = order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;
  const reduceOnly = isSingleSideMode
    ? order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT'
      ? 'true'
      : undefined
    : undefined;

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
  if (type === 'MARKET') {
    fetchTradeHistory(credential, order.product_id, symbol);
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
  if (type === 'MARKET') {
    fetchTradeHistory(credential, order.product_id, symbol);
  }
  return { order_id: `${res.orderId}` };
};

export const submitOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  const [, TYPE] = decodePath(order.product_id);

  if (TYPE === 'USDT-FUTURE') {
    return submitUnifiedOrder(credential, order);
  }
  if (TYPE === 'SPOT') {
    return submitSpotOrder(credential, order);
  }

  throw newError('BINANCE_SUBMIT_ORDER_UNSUPPORTED_PRODUCT_TYPE', { order });
};
