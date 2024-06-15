import { IDataRecord, IOrder } from '@yuants/data-model';

/**
 * Map order to data record
 * Consider the order as an instantaneous product
 * Can be safely cached
 *
 * @public
 */
export const wrapOrder = (order: IOrder): IDataRecord<IOrder> => ({
  id: `${order.account_id}/${order.order_id}`,
  type: `order`,
  created_at: order.submit_at!,
  updated_at: Date.now(),
  frozen_at: order.filled_at!,
  tags: {
    order_id: order.order_id || '',
    account_id: order.account_id,
    product_id: order.product_id,
    order_type: order.order_type || '',
    order_direction: order.order_direction || '',
  },
  origin: order,
});
