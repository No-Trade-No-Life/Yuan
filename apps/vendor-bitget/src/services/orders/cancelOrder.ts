import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postFutureCancelOrder, postSpotCancelOrder, type ICredential } from '../../api/private-api';

export const cancelOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, product_id] = decodePath(order.product_id);
  const [instType, instId] = decodePath(product_id);

  if (instType === 'USDT-FUTURES') {
    const res = await postFutureCancelOrder(credential, {
      symbol: instId,
      productType: instType,
      orderId: order.order_id,
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget cancel future order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  if (instType === 'SPOT') {
    const res = await postSpotCancelOrder(credential, {
      symbol: instId,
      orderId: order.order_id,
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget cancel spot order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
