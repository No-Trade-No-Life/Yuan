import { ICredential, isApiError } from '../../api/client';
import { getTradeOrderDetailById } from '../../api/private-api';

export const getTradeOrderDetail = async (credential: ICredential, symbol: string, orderId: number) => {
  const res = await getTradeOrderDetailById(credential, {
    symbol,
    orderId,
    timestamp: Date.now(),
  });
  if (isApiError(res)) {
    throw new Error(`Binance get order detail failed: ${res.code} ${res.msg}`);
  }
  return res;
};
