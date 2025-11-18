import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { getFuturesOrders, ICredential } from '../../api/private-api';

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

const resolveOrderDirection = (order: { size: number; is_close: boolean }): OrderDirection => {
  const isLong = order.size > 0;
  if (order.is_close) {
    return isLong ? 'CLOSE_SHORT' : 'CLOSE_LONG';
  }
  return isLong ? 'OPEN_LONG' : 'OPEN_SHORT';
};

export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  const orders = await getFuturesOrders(credential, 'usdt', { status: 'open' });
  return orders.map((order): IOrder => {
    const volume = Math.abs(order.size);
    const leftVolume = typeof order.left === 'number' ? Math.abs(order.left) : undefined;
    const traded_volume = leftVolume !== undefined ? Math.max(volume - leftVolume, 0) : undefined;
    const price = Number(order.price);
    const traded_price = Number(order.fill_price);
    return {
      order_id: `${order.id}`,
      account_id,
      product_id: order.contract,
      order_direction: resolveOrderDirection(order),
      volume,
      price: Number.isFinite(price) ? price : undefined,
      submit_at: order.create_time * 1000,
      traded_volume,
      traded_price: Number.isFinite(traded_price) ? traded_price : undefined,
      order_status: order.status,
    };
  });
};
