import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { ICredential, submitOrder as submitOrderApi } from '../../api/private-api';

export const submitOrder = async (credential: ICredential, order: IOrder): Promise<{ order_id: string }> => {
  // Parse product_id to get pair_id
  const productParts = order.product_id.split('/');
  const pair_id = productParts[productParts.length - 1];

  // Determine order_way based on order_direction
  // 1: 开多 (Open Long), 2: 平空 (Close Short), 3: 开空 (Open Short), 4: 平多 (Close Long)
  let order_way: 1 | 2 | 3 | 4;
  switch (order.order_direction) {
    case 'OPEN_LONG':
      order_way = 1;
      break;
    case 'CLOSE_SHORT':
      order_way = 2;
      break;
    case 'OPEN_SHORT':
      order_way = 3;
      break;
    case 'CLOSE_LONG':
      order_way = 4;
      break;
    default:
      throw new Error(`Unsupported order direction: ${order.order_direction}`);
  }

  // Determine order_type
  let order_type: 'limit' | 'market' | 'stop_limit' | 'stop_market';
  switch (order.order_type) {
    case 'LIMIT':
      order_type = 'limit';
      break;
    case 'MARKET':
      order_type = 'market';
      break;
    default:
      order_type = 'limit';
  }

  // Build the order request

  const response = await submitOrderApi(credential, {
    request_id: Date.now(),
    pair_id,
    pool_id: 2, // usdc
    coin_code: '2', // usdc
    order_type,
    order_way,
    margin_type: 2, // Default to cross margin
    leverage: 100,
    size: order.volume.toString(), // usdc value
    position_mode: 1, // Default to one-way
    time_in_force: 'GTC' as const,
    fee_mode: 1,
    order_mode: 1 as const, // Normal order
    price: order.price?.toString(),
  });

  return { order_id: response.data.order.id };
};
