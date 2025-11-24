import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { getSpotAccounts, ICredential } from '../../api/private-api';

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const res = await getSpotAccounts(credential);
  if (!Array.isArray(res)) {
    throw new Error('Failed to load spot balances');
  }
  return res.map((item) => {
    return makeSpotPosition({
      position_id: item.currency,
      product_id: `${item.currency}-USDT`,
      volume: Number(item.available),
      free_volume: Number(item.available),
      closable_price: 1, // TODO: use real price
    });
  });
};
