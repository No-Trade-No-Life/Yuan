import { IOrder } from '@yuants/data-order';
import { postFuturePlaceOrder, type ICredential } from '../../api/private-api';
import { buildFutureOrderParams } from './order-utils';

export const submitOrder = async (credential: ICredential, order: IOrder) => {
  const params = buildFutureOrderParams(order);
  const res = await postFuturePlaceOrder(credential, params);
  if (res.msg !== 'success') {
    throw new Error(`Bitget submit order failed: ${res.code} ${res.msg}`);
  }
  return { order_id: res.data.orderId };
};
