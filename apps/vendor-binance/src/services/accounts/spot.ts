import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

export const getSpotAccountInfoSnapshot = async (credential: ICredential): Promise<IPosition[]> => {
  const res = await getSpotAccountInfo(credential, { omitZeroBalances: true });
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  const positions = res.balances
    .map((balance) => {
      const volume = +balance.free + +balance.locked;
      if (!volume) return undefined;
      const position: IPosition = makeSpotPosition({
        position_id: `spot/${balance.asset}`,
        datasource_id: 'BINANCE',
        product_id: encodePath('BINANCE', 'SPOT', `${balance.asset}USDT`),
        volume,
        free_volume: +balance.free,
        closable_price: 0, // TODO: fetch price later
      });
      return position;
    })
    .filter((position): position is IPosition => Boolean(position));
  return positions;
};
