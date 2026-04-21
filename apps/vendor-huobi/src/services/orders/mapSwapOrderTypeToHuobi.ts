import { IOrder } from '@yuants/data-order';

export const mapSwapOrderTypeToHuobi = (orderType?: IOrder['order_type']) => {
  if (orderType === 'MARKET') return { order_price_type: 'market' };
  if (orderType === 'LIMIT') return { order_price_type: 'limit' };
  if (orderType === 'IOC') return { order_price_type: 'ioc' };
  if (orderType === 'FOK') return { order_price_type: 'fok' };
  throw new Error(`Unsupported order_type: ${orderType}`);
};

export const mapUnionSwapOrderTypeToHuobi = (orderType?: IOrder['order_type']) => {
  if (orderType === 'MARKET') return { type: 'market' as const };
  if (orderType === 'LIMIT') return { type: 'limit' as const };
  if (orderType === 'IOC') return { type: 'limit' as const, time_in_force: 'ioc' as const };
  if (orderType === 'FOK') return { type: 'limit' as const, time_in_force: 'fok' as const };
  throw new Error(`Unsupported order_type: ${orderType}`);
};
