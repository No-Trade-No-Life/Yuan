import { getTradeOrderDetailById } from '../../api/private-api';
import { ICredential } from '../../api/types';

export const getTradeOrderDetail = async (credential: ICredential, orderId: string) => {
  const res = await getTradeOrderDetailById(credential, { orderId });
  if (res.code !== '00000') {
    throw new Error(`Bitget get order detail failed: ${res.code} ${res.msg}`);
  }
  return res.data;
};
