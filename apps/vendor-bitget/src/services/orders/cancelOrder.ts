import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { postFutureCancelOrder, type ICredential } from '../../api/private-api';

export const cancelOrder = async (credential: ICredential, order: IOrder) => {
  const [instType, instId] = decodePath(order.product_id);
  const res = await postFutureCancelOrder(credential, {
    symbol: instId,
    productType: instType,
    orderId: order.order_id,
  });
  if (res.msg !== 'success') {
    throw new Error(`Bitget cancel order failed: ${res.code} ${res.msg}`);
  }
};
