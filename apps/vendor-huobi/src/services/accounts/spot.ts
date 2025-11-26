import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { getSpotAccountBalance, ICredential } from '../../api/private-api';
import { spotAccountUidCache } from '../uid';
import { encodePath } from '@yuants/utils';

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const spotAccountUid = await spotAccountUidCache.query(JSON.stringify(credential));
  if (!spotAccountUid) throw new Error('Failed to get Spot Account UID');
  const spotBalance = await getSpotAccountBalance(credential, spotAccountUid);

  return spotBalance.data.list
    .map((v) => {
      return makeSpotPosition({
        position_id: `${v.currency}`,
        datasource_id: 'HTX',
        product_id: encodePath('HTX', 'SPOT', v.currency),
        volume: +(v.balance ?? 0),
        free_volume: +(v.balance ?? 0),
        closable_price: 1, // TODO: 获取现货币对价格
      });
    })
    .filter((x) => x.volume > 0);
};
