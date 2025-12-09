import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postPlaceOrder } from '../../api/private-api';
import { ICredential } from '../../api/types';
import { mapOrderDirectionToSide } from './order-utils';

export const submitOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, instType, instId] = decodePath(order.product_id);
  const isMaker = order.order_type === 'MAKER';

  if (instType === 'USDT-FUTURES') {
    const res = await postPlaceOrder(credential, {
      category: 'USDT-FUTURES',
      symbol: instId,
      qty: '' + order.volume,
      price: order.price !== undefined ? '' + order.price : undefined,
      side: mapOrderDirectionToSide(order.order_direction),
      orderType: order.order_type === 'LIMIT' || isMaker ? 'limit' : 'market',
      timeInForce: isMaker ? 'post_only' : undefined,
      posSide: order.order_direction?.includes('LONG') ? 'long' : 'short',
      // UTA error 25238: posSide and reduceOnly cannot be used together; hedge mode relies on posSide+side.
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget submit future order failed: ${res.code} ${res.msg}`);
    }
    return { order_id: res.data.orderId };
  }

  if (instType === 'SPOT') {
    const res = await postPlaceOrder(credential, {
      category: 'SPOT',
      symbol: instId,
      side: mapOrderDirectionToSide(order.order_direction),
      orderType: order.order_type === 'MARKET' ? 'market' : 'limit',
      timeInForce: isMaker ? 'post_only' : undefined,
      price: order.price !== undefined ? '' + order.price : undefined,
      qty: order.volume?.toString() ?? '0',
      clientOid: (order as any).client_order_id,
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget submit spot order failed: ${res.code} ${res.msg}`);
    }
    return { order_id: res.data.orderId };
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
