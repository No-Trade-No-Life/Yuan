import { getTradeOrderDetailById, ICredential } from '../../api/private-api';

export const getTradeOrderDetail = async (
  credential: ICredential,
  contract_code: string,
  orderId: string,
) => {
  const res = await getTradeOrderDetailById(credential, { contract_code, order_id: orderId });
  if (res.code !== 200) {
    throw new Error(`Huobi get order detail failed: ${res.code} ${res.message}`);
  } else {
    return res.data;
  }
};
