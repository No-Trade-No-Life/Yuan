import { IOrder } from '@yuants/data-order';

export const getSettleFromAccountId = (account_id: string) => {
  const match = /^gate\/[^/]+\/future\/([^/]+)$/i.exec(account_id);
  if (!match) {
    throw new Error(`Unsupported Gate account_id: ${account_id}`);
  }
  return match[1].toLowerCase();
};

export const buildFutureOrderParams = (order: IOrder) => {
  if (!order.product_id) {
    throw new Error('product_id is required');
  }
  if (!order.order_direction) {
    throw new Error('order_direction is required');
  }
  if (!order.volume) {
    throw new Error('volume is required');
  }
  const directionSign =
    order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 1 : -1;
  const isClose = order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT';
  const order_type = order.order_type ?? 'LIMIT';
  return {
    contract: order.product_id,
    size: order.volume * directionSign,
    price: order_type === 'MARKET' ? '0' : `${order.price ?? 0}`,
    tif: order_type === 'MARKET' ? 'ioc' : 'gtc',
    reduce_only: isClose,
  };
};

export const buildGateErrorMessage = (res: any) => {
  if (!res) return 'Unknown Gate response';
  if (res.label || res.message || res.detail) {
    return [res.label, res.message, res.detail].filter(Boolean).join(': ');
  }
  if (res.code && res.msg) {
    return `${res.code}: ${res.msg}`;
  }
  return JSON.stringify(res);
};
