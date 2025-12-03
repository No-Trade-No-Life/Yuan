import type { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { getUnifiedAccounts, ICredential } from '../../api/private-api';
import { getSpotTickers } from '../../api/public-api';
import { loadFuturePositions } from './future';
import { encodePath } from '@yuants/utils';

export const getUnifiedAccountInfo = async (credential: ICredential) => {
  const [futurePositions, unifiedAccount, spotTickers] = await Promise.all([
    loadFuturePositions(credential),
    getUnifiedAccounts(credential, {}),
    getSpotTickers({}),
  ]);

  const balances = unifiedAccount?.balances ?? {};
  const spotTickerList = Array.isArray(spotTickers) ? spotTickers : [];
  const spotPositions: IPosition[] = Object.keys(balances)
    .map((currency) => {
      let currency_pair = `${currency}_USDT`;
      if (currency === 'SOL2') {
        currency_pair = 'SOL_USDT';
      }
      if (currency === 'GTSOL') {
        currency_pair = 'SOL_USDT';
      }
      const closable_price =
        currency === 'USDT'
          ? 1
          : Number(spotTickerList.find((ticker) => ticker.currency_pair === currency_pair)?.last || 0);
      const volume = Number(balances[currency]?.available || 0);
      if (Math.abs(volume) === 0) return undefined;
      return {
        datasource_id: 'gate/spot',
        position_id: currency,
        product_id: encodePath('GATE', 'SPOT', currency),
        direction: 'LONG',
        volume,
        free_volume: volume,
        closable_price,
        position_price: closable_price,
        floating_profit: closable_price * volume,
        valuation: closable_price * volume,
      } as IPosition;
    })
    .filter((item): item is IPosition => !!item);

  return [...futurePositions, ...spotPositions];
};
