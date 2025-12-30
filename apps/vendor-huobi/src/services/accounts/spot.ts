import { IActionHandlerOfGetAccountInfo, IPosition, makeSpotPosition } from '@yuants/data-account';
import { getSpotAccountBalance, ICredential } from '../../api/private-api';
import { spotAccountUidCache } from '../uid';
import { encodePath } from '@yuants/utils';
import { quoteCache } from '../market-data/quote';

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const spotAccountUid = await spotAccountUidCache.query(JSON.stringify(credential));
  if (!spotAccountUid) throw new Error('Failed to get Spot Account UID');
  const spotBalance = await getSpotAccountBalance(credential, spotAccountUid);

  const positions: IPosition[] = [];

  for (const v of spotBalance.data.list) {
    if (v.balance === '0') continue;
    const product_id = encodePath('HTX', 'SPOT', v.currency + 'usdt');
    const quote = await quoteCache.query(product_id);
    const closable_price = v.currency === 'usdt' ? 1 : +(quote?.ask_price ?? 0);
    positions.push(
      makeSpotPosition({
        position_id: `${v.currency}`,
        datasource_id: 'HTX',
        product_id: product_id,
        volume: +(v.balance ?? 0),
        free_volume: +(v.balance ?? 0),
        closable_price: closable_price,
        size: v.balance,
      }),
    );
  }
  return positions;
};
