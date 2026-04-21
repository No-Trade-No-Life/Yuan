import { IOrder } from '@yuants/data-order';
import { getSwapOpenOrders, ICredential } from '../../api/private-api';
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

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
        order_type: mapHuobiSwapOrderToOrderType(v.order_price_type),
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
