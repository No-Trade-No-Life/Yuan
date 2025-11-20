import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postFuturePlaceOrder, postSpotPlaceOrder, type ICredential } from '../../api/private-api';
import { buildFutureOrderParams, mapOrderDirectionToSide } from './order-utils';

export const submitOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, product_id] = decodePath(order.product_id);
  const [instType, instId] = decodePath(product_id);

  if (instType === 'USDT-FUTURES') {
    const params = buildFutureOrderParams(order);
    const res = await postFuturePlaceOrder(credential, params);
    if (res.msg !== 'success') {
      throw new Error(`Bitget submit future order failed: ${res.code} ${res.msg}`);
    }
    return { order_id: res.data.orderId };
  }

  if (instType === 'SPOT') {
    const res = await postSpotPlaceOrder(credential, {
      symbol: instId,
      side: mapOrderDirectionToSide(order.order_direction),
      orderType: 'limit', // Default to limit for now
      price: order.price?.toString(),
      quantity: order.volume?.toString(),
      clientOid: (order as any).client_order_id,
      force: 'normal',
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget submit spot order failed: ${res.code} ${res.msg}`);
    }
    return { order_id: res.data.orderId };
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
