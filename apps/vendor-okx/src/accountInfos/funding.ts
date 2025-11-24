import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { ICredential, getAssetBalances } from '../api/private-api';
import { getSpotPrice } from './trading';

export const getFundingAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const assetBalances = await getAssetBalances(credential, {});

  return assetBalances.data.map((x) =>
    makeSpotPosition({
      datasource_id: 'OKX',
      position_id: encodePath('SPOT', `${x.ccy}-USDT`),
      product_id: encodePath('SPOT', `${x.ccy}-USDT`),
      volume: +x.bal,
      free_volume: +x.bal,
      closable_price: getSpotPrice(x.ccy),
    }),
  );
};
