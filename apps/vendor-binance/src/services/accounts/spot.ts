import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
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
  const positions = res.balances
    .filter((balance) => balance.asset !== 'USDT')
    .map((balance) => {
      const volume = +balance.free + +balance.locked;
      if (!volume) return undefined;
      const position: IPosition = {
        position_id: `spot/${balance.asset}`,
        datasource_id: 'BINANCE',
        product_id: encodePath('spot', `${balance.asset}USDT`),
        direction: 'LONG',
        volume,
        free_volume: +balance.free,
        position_price: 0,
        closable_price: 0,
        floating_profit: 0,
        valuation: 0,
      };
      return position;
    })
    .filter((position): position is IPosition => Boolean(position));
  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions,
  };
};
