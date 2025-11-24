import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { firstValueFrom } from 'rxjs';
import { ICredential, getFinanceSavingsBalance } from '../api/private-api';
import { getSpotPrice, marketIndexTickerUSDT$ } from './trading';

export const getEarningAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const offers = await getFinanceSavingsBalance(credential, {});

  return offers.data.map((offer) => {
    return makeSpotPosition({
      position_id: `earning/${offer.ccy}`,
      datasource_id: 'OKX',
      product_id: `earning/${offer.ccy}`,
      volume: +offer.amt,
      free_volume: +offer.amt,
      closable_price: getSpotPrice(offer.ccy),
    });
  });
};
