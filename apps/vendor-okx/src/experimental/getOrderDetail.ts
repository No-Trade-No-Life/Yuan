import { getTradeOrder, ICredential } from '../api/private-api';

export const getTradeOrderDetail = async (credential: ICredential, product_id: string, order_id: string) => {
  const result = await getTradeOrder(credential, { ordId: order_id, instId: product_id });
  if (result.code !== '0') {
    throw new Error(`OKX API error: ${result.code} ${result.msg}`);
  }
  const order = result.data.find((x) => x.ordId === order_id);
  if (!order) {
    throw new Error(`Order not found: ${order_id}`);
  }
  return order;
};
