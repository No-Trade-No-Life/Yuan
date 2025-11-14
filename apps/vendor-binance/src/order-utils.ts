import { IOrder } from '@yuants/data-order';
import { createHash } from 'crypto';

export const mapOrderDirectionToSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_SHORT':
      return 'BUY';
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
      return 'SELL';
    default:
      throw new Error(`Unknown direction: ${direction}`);
  }
};

export const mapOrderDirectionToPosSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_LONG':
      return 'LONG';
    case 'OPEN_SHORT':
    case 'CLOSE_SHORT':
      return 'SHORT';
    default:
      throw new Error(`Unknown direction: ${direction}`);
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
      throw new Error(`Unknown order type: ${order_type}`);
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

export const deriveClientOrderId = (order: IOrder) => {
  if (order.order_id) return `${order.order_id}`;
  if (order.comment) return order.comment;
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
