import type { IPosition } from '@yuants/data-account';
import { getSpotTickers } from '../../api/public-api';
import { getUnifiedAccounts, ICredential } from '../../api/private-api';
import { loadFuturePositions } from './future';

export const getUnifiedAccountInfo = async (credential: ICredential, account_id: string) => {
  const [futurePositions, unifiedAccount, spotTickers] = await Promise.all([
    loadFuturePositions(credential),
    getUnifiedAccounts(credential, {}),
    getSpotTickers({}),
  ]);

  const balances = unifiedAccount?.balances ?? {};
  const spotTickerList = Array.isArray(spotTickers) ? spotTickers : [];

  const spotPositions: IPosition[] = Object.keys(balances)
    .map((currency) => {
      if (currency === 'USDT') return undefined;
      let currency_pair = `${currency}_USDT`;
      if (currency === 'SOL2') {
        currency_pair = 'SOL_USDT';
      }
      const closable_price = Number(
        spotTickerList.find((ticker) => ticker.currency_pair === currency_pair)?.last || 0,
      );
      const volume = Number(balances[currency]?.available || 0);
      return {
        datasource_id: 'gate/spot',
        position_id: currency,
        product_id: currency,
        direction: 'LONG',
        volume,
        free_volume: volume,
        closable_price,
        position_price: closable_price,
        floating_profit: 0,
        valuation: closable_price * volume,
      } as IPosition;
    })
    .filter((item): item is IPosition => !!item);

  const free = Number(balances['USDT']?.available || 0);
  const equity = Number(unifiedAccount?.unified_account_total_equity || 0);

  return {
    account_id,
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions: [...futurePositions, ...spotPositions],
  };
};
