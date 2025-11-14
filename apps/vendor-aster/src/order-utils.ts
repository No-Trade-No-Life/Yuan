import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';

const directionToSide: Record<string, 'BUY' | 'SELL'> = {
  OPEN_LONG: 'BUY',
  CLOSE_SHORT: 'BUY',
  OPEN_SHORT: 'SELL',
  CLOSE_LONG: 'SELL',
};

const orderTypeMap: Record<string, 'MARKET' | 'LIMIT'> = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
  MAKER: 'LIMIT',
};

export const resolveSymbolFromProduct = (product_id: string) => {
  const [, symbol] = decodePath(product_id);
  if (symbol) {
    return symbol;
  }
  if (!product_id) {
    throw new Error('product_id is required');
  }
  return product_id;
};

export const resolveOrderSide = (order: IOrder) => {
  const side = directionToSide[order.order_direction ?? ''];
  if (!side) {
    throw new Error(`Unsupported order_direction: ${order.order_direction}`);
  }
  return side;
};

export const resolveOrderType = (order: IOrder) => {
  const type = orderTypeMap[order.order_type ?? ''];
  if (!type) {
    throw new Error(`Unsupported order_type: ${order.order_type}`);
  }
  return type;
};

export const resolveTimeInForce = (order: IOrder) => {
  if (order.order_type === 'MAKER') {
    return 'GTX';
  }
  if (order.order_type === 'LIMIT') {
    return 'GTC';
  }
  return undefined;
};

export const resolvePositionSide = (order: IOrder) => {
  if (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG') {
    return 'LONG';
  }
  if (order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_SHORT') {
    return 'SHORT';
  }
  return undefined;
};

export const isReduceOnly = (order: IOrder) =>
  order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT';

export const buildPerpetualOrderParams = (order: IOrder) => ({
  symbol: resolveSymbolFromProduct(order.product_id),
  side: resolveOrderSide(order),
  type: resolveOrderType(order),
  quantity: order.volume,
  price: order.price,
  timeInForce: resolveTimeInForce(order),
  positionSide: resolvePositionSide(order),
  reduceOnly: isReduceOnly(order) ? 'true' : undefined,
});

export const buildSpotOrderParams = (order: IOrder) => ({
  symbol: resolveSymbolFromProduct(order.product_id),
  side: resolveOrderSide(order),
  type: resolveOrderType(order),
  timeInForce: resolveTimeInForce(order),
  price: order.price,
  quantity: order.volume,
});

export const requiresSpotQuoteOrderQty = (order: IOrder) =>
  resolveOrderType(order) === 'MARKET' && resolveOrderSide(order) === 'BUY';

export const resolveAccountScope = (account_id: string) => {
  const parts = account_id.split('/');
  return parts[2]?.toLowerCase();
};

export const isPerpetualAccount = (account_id: string) => resolveAccountScope(account_id) === 'perp';
export const isSpotAccount = (account_id: string) => resolveAccountScope(account_id) === 'spot';
