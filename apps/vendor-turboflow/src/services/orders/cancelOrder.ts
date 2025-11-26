import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { ICredential, cancelOrder as cancelOrderApi } from '../../api/private-api';

export const cancelOrderAction = async (credential: ICredential, order: IOrder): Promise<void> => {
  console.info(`[${formatTime(Date.now())}] Cancelling order ${order.order_id}`);

  // Parse product_id to get pair_id
  const productParts = order.product_id.split('/');
  const pair_id = productParts[productParts.length - 1];

  // Parse comment for pool_id
  let pool_id = 1;
  if (order.comment) {
    try {
      const params = JSON.parse(order.comment);
      pool_id = params.pool_id || 1;
    } catch (e) {
      console.warn(`[${formatTime(Date.now())}] Failed to parse order comment:`, e);
    }
  }

  if (!order.order_id) {
    throw new Error('order_id is required for cancelling order');
  }

  const response = await cancelOrderApi(credential, {
    pair_id,
    order_id: order.order_id,
    pool_id,
  });

  if (response.errno !== '200') {
    throw new Error(`Failed to cancel order: ${response.msg}`);
  }
};
