import { IActionHandlerOfGetAccountInfo } from '@yuants/data-account';
import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

export const getSpotAccountInfoSnapshot: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential,
  _accountId,
) => {
  const res = await getSpotAccountInfo(credential, { omitZeroBalances: true });
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  const usdtAsset = res.balances.find((balance) => balance.asset === 'USDT');
  const free = +(usdtAsset?.free ?? 0);
  const locked = +(usdtAsset?.locked ?? 0);
  const equity = free + locked;
  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions: [],
  };
};
