import { getTradeOrderDetailById, ICredential } from '../../api/private-api';

export const getTradeOrderDetail = async (credential: ICredential, orderId: string) => {
  const res = await getTradeOrderDetailById(credential, { settle: 'usdt', order_id: orderId });
  if (!res) {
    throw new Error(`Gate get order detail failed`);
  }
  return res;
};
