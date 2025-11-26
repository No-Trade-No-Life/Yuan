import { IOrder } from '@yuants/data-order';
import { getSwapOpenOrders, ICredential } from '../../api/private-api';

export const listSwapOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const orders: IOrder[] = [];
  let page_index = 1;
  const page_size = 50;

  while (true) {
    const ordersRes = await getSwapOpenOrders(credential, { page_index, page_size });
    if (!ordersRes.data?.orders || ordersRes.data.orders.length === 0) {
      break;
    }

    const pageOrders: IOrder[] = ordersRes.data.orders.map((v): IOrder => {
      return {
        order_id: v.order_id_str,
        account_id: `huobi/swap`, // Placeholder, will be adjusted if needed
        product_id: v.contract_code,
        order_type: ['lightning'].includes(v.order_price_type)
          ? 'MARKET'
          : ['limit', 'opponent', 'post_only', 'optimal_5', 'optimal_10', 'optimal_20'].includes(
              v.order_price_type,
            )
          ? 'LIMIT'
          : ['fok'].includes(v.order_price_type)
          ? 'FOK'
          : v.order_price_type.includes('ioc')
          ? 'IOC'
          : 'STOP', // unreachable code
        order_direction:
          v.direction === 'open'
            ? v.offset === 'buy'
              ? 'OPEN_LONG'
              : 'OPEN_SHORT'
            : v.offset === 'buy'
            ? 'CLOSE_SHORT'
            : 'CLOSE_LONG',
        volume: v.volume,
        submit_at: v.created_at,
        price: v.price,
        traded_volume: v.trade_volume,
      };
    });

    orders.push(...pageOrders);
    page_index++;
  }
  return orders;
};
