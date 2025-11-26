import { makeSpotPosition } from '@yuants/data-account';
import { getSpotAccounts, ICredential } from '../../api/private-api';
import { encodePath } from '@yuants/utils';

export const getSpotAccountInfo = async (credential: ICredential) => {
  const res = await getSpotAccounts(credential);
  if (!Array.isArray(res)) {
    throw new Error('Failed to load spot balances');
  }
  return res.map((item) => {
    return makeSpotPosition({
      datasource_id: 'GATE',
      position_id: item.currency,
      product_id: encodePath('GATE', 'SPOT', `${item.currency}-USDT`),
      volume: Number(item.available),
      free_volume: Number(item.available),
      closable_price: 1, // TODO: use real price
    });
  });
};
