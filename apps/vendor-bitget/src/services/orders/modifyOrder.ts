import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postFutureModifyOrder, postSpotCancelReplaceOrder, type ICredential } from '../../api/private-api';

export const modifyOrder = async (credential: ICredential, order: IOrder) => {
  const [datasource_id, product_id] = decodePath(order.product_id);
  const [instType, instId] = decodePath(product_id);

  if (instType === 'USDT-FUTURES') {
    const res = await postFutureModifyOrder(credential, {
      symbol: instId,
      productType: instType,
      orderId: order.order_id,
      newPrice: order.price?.toString(),
      newSize: order.volume?.toString(),
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget modify future order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  if (instType === 'SPOT') {
    const res = await postSpotCancelReplaceOrder(credential, {
      symbol: instId,
      orderId: order.order_id,
      newPrice: order.price?.toString(),
      newSize: order.volume?.toString(),
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget modify spot order failed: ${res.code} ${res.msg}`);
    }
    return;
  }

  throw new Error(`Unsupported product_id: ${order.product_id}`);
};
