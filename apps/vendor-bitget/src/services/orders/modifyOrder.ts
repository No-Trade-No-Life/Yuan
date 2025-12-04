import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postModifyOrder } from '../../api/private-api';
import { ICredential } from '../../api/types';

export const modifyOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, instType, instId] = decodePath(order.product_id);

  if (instType === 'USDT-FUTURES') {
    const res = await postModifyOrder(credential, {
      orderId: order.order_id,
      price: order.price?.toString(),
      qty: order.volume?.toString(),
      category: 'USDT-FUTURES',
      symbol: instId,
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget modify future order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  if (instType === 'SPOT') {
    const res = await postModifyOrder(credential, {
      orderId: order.order_id,
      price: order.price?.toString(),
      qty: order.volume?.toString(),
      category: 'SPOT',
      symbol: instId,
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget modify spot order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
