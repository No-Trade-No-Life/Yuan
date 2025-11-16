import { IActionHandlerOfGetAccountInfo } from '@yuants/data-account';
import { getSpotAccountBalance, ICredential } from '../api/private-api';
import { spotAccountUidCache } from '../uid';

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const spotAccountUid = await spotAccountUidCache.query(JSON.stringify(credential));
  if (!spotAccountUid) throw new Error('Failed to get Spot Account UID');
  const spotBalance = await getSpotAccountBalance(credential, spotAccountUid);

  const equity = +(spotBalance.data.list.find((v) => v.currency === 'usdt')?.balance ?? 0);
  const free = equity;
  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions: [],
  };
};
