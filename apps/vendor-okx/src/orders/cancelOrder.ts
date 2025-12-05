import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { ICredential, postTradeCancelOrder } from '../api/private-api';

export const cancelOrder = async (credential: ICredential, order: IOrder) => {
  const [instId] = decodePath(order.product_id).slice(-1);
  const res = await postTradeCancelOrder(credential, {
    instId,
    ordId: order.order_id!,
  });
  if (res.code !== '0') {
    throw new Error(`Cancel order failed: code=${res.code} msg=${res.msg}`);
  }
};
