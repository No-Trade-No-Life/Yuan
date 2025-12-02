import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { ICredential, getOrderList } from '../../api/private-api';

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

/**
 * Map TurboFlow order_way to order direction
 * 1: 开多 (Open Long), 2: 平空 (Close Short), 3: 开空 (Open Short), 4: 平多 (Close Long)
 */
const mapOrderDirection = (order_way: number): OrderDirection => {
  switch (order_way) {
    case 1:
      return 'OPEN_LONG';
    case 2:
      return 'CLOSE_SHORT';
    case 3:
      return 'OPEN_SHORT';
    case 4:
      return 'CLOSE_LONG';
    default:
      return 'OPEN_LONG';
  }
};

/**
 * Map TurboFlow order to Yuan IOrder format
 */
const mapOrder = (order: any): IOrder => {
  const volume = parseFloat(order.size) || 0;
  const price = parseFloat(order.price) || 0;

  return {
    order_id: order.id,
    account_id: '', // Will be filled in listOrders
    product_id: encodePath('PERPETUAL', order.pair_id),
    order_type: order.order_type.toUpperCase() as any,
    order_direction: mapOrderDirection(order.order_way),
    volume: Number.isFinite(volume) ? volume : 0,
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    submit_at: new Date(order.created_at).getTime(),
    order_status: order.order_status.toLowerCase(),
    comment: JSON.stringify({
      pool_id: order.pool_id,
      pair_id: order.pair_id,
      coin_code: order.coin_code,
      leverage: order.leverage,
      margin_type: order.margin_type,
      fee_mode: order.fee_mode,
      pos_mode: order.pos_mode,
      position_id: order.position_id,
    }),
  };
};

/**
 * List orders implementation
 */
export const listOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const response = await getOrderList(credential, {
    page_num: 1,
    page_size: 100,
    status: 'Pending',
  });

  return response.data.data?.map((order) => mapOrder(order)) || [];
};
