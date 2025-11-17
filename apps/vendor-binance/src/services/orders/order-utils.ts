import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { createHash } from 'crypto';

export const decodeFutureSymbol = (product_id: string) => {
  const [instType, symbol] = decodePath(product_id);
  if (instType !== 'usdt-future' || !symbol) {
    throw new Error(`Unsupported product_id for Binance futures: ${product_id}`);
  }
  return symbol;
};

export const decodeSpotSymbol = (product_id: string) => {
  try {
    const [instType, symbol] = decodePath(product_id);
    if (instType?.toLowerCase() === 'spot' && symbol) {
      return symbol;
    }
  } catch (err) {
    // ignore decode errors and fall back to raw product id
  }
  if (!product_id.includes('/')) {
    return product_id;
  }
  throw new Error(`Unsupported product_id for Binance spot: ${product_id}`);
};

export const mapOrderDirectionToSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_SHORT':
      return 'BUY';
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
      return 'SELL';
    default:
      throw new Error(`Unsupported order_direction: ${direction}`);
  }
};

export const mapOrderDirectionToPositionSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_LONG':
      return 'LONG';
    case 'OPEN_SHORT':
    case 'CLOSE_SHORT':
      return 'SHORT';
    default:
      throw new Error(`Unsupported order_direction for positionSide: ${direction}`);
  }
};

export const mapOrderTypeToOrdType = (order_type?: IOrder['order_type']) => {
  switch (order_type) {
    case 'LIMIT':
    case 'MAKER':
      return 'LIMIT';
    case 'MARKET':
      return 'MARKET';
    default:
      throw new Error(`Unsupported order_type: ${order_type}`);
  }
};

export const mapBinanceOrderTypeToYuants = (binanceType?: string): IOrder['order_type'] => {
  switch (binanceType) {
    case 'LIMIT':
      return 'LIMIT';
    case 'MARKET':
      return 'MARKET';
    default:
      return 'LIMIT';
  }
};

export const mapBinanceSideToYuantsDirection = (
  side?: string,
  positionSide?: string,
): IOrder['order_direction'] | undefined => {
  if (!side || !positionSide) {
    return undefined;
  }
  if (positionSide === 'LONG') {
    return side === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (positionSide === 'SHORT') {
    return side === 'SELL' ? 'OPEN_SHORT' : 'CLOSE_SHORT';
  }
  return undefined;
};

export const mapSpotSideToOrderDirection = (side?: string): IOrder['order_direction'] => {
  if (side === 'SELL') {
    return 'CLOSE_LONG';
  }
  return 'OPEN_LONG';
};

export const deriveClientOrderId = (order: IOrder) => {
  if (order.order_id) return `${order.order_id}`;
  const payload = JSON.stringify({
    account_id: order.account_id,
    product_id: order.product_id,
    order_direction: order.order_direction,
    order_type: order.order_type,
    price: order.price,
    volume: order.volume,
  });
  return `YUANTS${createHash('sha256').update(payload).digest('hex').slice(0, 24)}`;
};

const BinanceOrderStatusMap: Record<string, IOrder['order_status']> = {
  NEW: 'ACCEPTED',
  PARTIALLY_FILLED: 'TRADED',
  FILLED: 'TRADED',
  PENDING_NEW: 'ACCEPTED',
  PENDING_CANCEL: 'CANCELLED',
  CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'CANCELLED',
  EXPIRED: 'CANCELLED',
};

export const mapBinanceOrderStatus = (status?: string): IOrder['order_status'] => {
  if (!status) return 'ACCEPTED';
  return BinanceOrderStatusMap[status] ?? 'ACCEPTED';
};
