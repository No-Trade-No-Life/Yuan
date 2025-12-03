import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postCancelOrder } from '../../api/private-api';
import { ICredential } from '../../api/types';

export const cancelOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, instType, instId] = decodePath(order.product_id);

  if (instType === 'USDT-FUTURES') {
    const res = await postCancelOrder(credential, { orderId: order.order_id, category: 'USDT-FUTURES' });
    if (res.msg !== 'success') {
      throw new Error(`Bitget cancel future order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  if (instType === 'SPOT') {
    const res = await postCancelOrder(credential, { orderId: order.order_id, category: 'SPOT' });
    if (res.msg !== 'success') {
      throw new Error(`Bitget cancel spot order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
