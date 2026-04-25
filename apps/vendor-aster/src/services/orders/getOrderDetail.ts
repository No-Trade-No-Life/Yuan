import { getTradeOrderDetailById, ICredential } from '../../api/private-api';

export const getTradeOrderDetail = async (credential: ICredential, symbol: string, orderId: number) => {
  const res = await getTradeOrderDetailById(credential, {
    symbol,
    orderId,
    timestamp: Date.now(),
  });
  if (!res) {
    throw new Error(`ASTER get order detail failed`);
  }
  return res;
};
