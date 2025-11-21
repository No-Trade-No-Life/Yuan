import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';

export const mapOrderDirectionToSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'CLOSE_SHORT':
      return 'buy';
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
      return 'sell';
  }
  throw new Error(`Unknown order direction: ${direction}`);
};

export const mapOrderDirectionToTradeSide = (direction?: IOrder['order_direction']) => {
  switch (direction) {
    case 'OPEN_LONG':
    case 'OPEN_SHORT':
      return 'open';
    case 'CLOSE_LONG':
    case 'CLOSE_SHORT':
      return 'close';
  }
  throw new Error(`Unknown order direction: ${direction}`);
};

export const buildFutureOrderParams = (order: IOrder) => {
  const [instType, instId] = decodePath(order.product_id);
  return {
    symbol: instId,
    productType: instType,
    marginMode: 'crossed',
    marginCoin: 'USDT',
    size: '' + order.volume,
    price: order.price !== undefined ? '' + order.price : undefined,
    side: mapOrderDirectionToSide(order.order_direction),
    tradeSide: mapOrderDirectionToTradeSide(order.order_direction),
    orderType: order.order_type === 'LIMIT' ? 'limit' : 'market',
  };
};
