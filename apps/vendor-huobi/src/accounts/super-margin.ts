import { createCache } from '@yuants/cache';
import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { formatTime } from '@yuants/utils';
import { getSpotAccountBalance, ICredential } from '../api/private-api';
import { getSpotTick } from '../api/public-api';
import { superMarginAccountUidCache } from '../uid';

const spotTickCache = createCache((currency) => getSpotTick({ symbol: `${currency}usdt` }), {
  expire: 300_000, // 5 minutes
  swrAfter: 10_000, // 10 seconds
});

/**
 * 全仓杠杆账户 (Super Margin Account)
 */
export const getSuperMarginAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  // get account balance
  const superMarginAccountUid = await superMarginAccountUidCache.query(JSON.stringify(credential));
  if (!superMarginAccountUid) throw new Error('Failed to get Super Margin Account UID');
  const accountBalance = await getSpotAccountBalance(credential, superMarginAccountUid);
  const balanceList = accountBalance.data?.list || [];

  // calculate usdt balance
  const usdtBalance = balanceList
    .filter((v) => v.currency === 'usdt')
    .reduce((acc, cur) => acc + +cur.balance, 0);

  // get positions (non-usdt currencies)
  const positions: IPosition[] = [];
  const nonUsdtCurrencies = balanceList
    .filter((v) => v.currency !== 'usdt')
    .reduce((acc, cur) => {
      const existing = acc.find((item) => item.currency === cur.currency);
      if (existing) {
        existing.balance += +cur.balance;
      } else {
        acc.push({ currency: cur.currency, balance: +cur.balance });
      }
      return acc;
    }, [] as { currency: string; balance: number }[]);

  // get prices and create positions
  for (const currencyData of nonUsdtCurrencies) {
    if (currencyData.balance > 0) {
      const tickerRes = await spotTickCache.query(currencyData.currency);
      const price = tickerRes?.tick.close || 0;
      try {
        // get current price from websocket or fallback to REST API

        positions.push({
          position_id: `${currencyData.currency}/usdt/spot`,
          product_id: `${currencyData.currency}usdt`,
          direction: 'LONG',
          volume: currencyData.balance,
          free_volume: currencyData.balance,
          position_price: price,
          closable_price: price,
          floating_profit: 0,
          valuation: currencyData.balance * price,
        });
      } catch (error) {
        console.warn(formatTime(Date.now()), `Failed to get price for ${currencyData.currency}:`, error);
      }
    }
  }

  // calculate equity
  const equity = positions.reduce((acc, cur) => acc + cur.closable_price * cur.volume, 0) + usdtBalance;

  return {
    money: {
      currency: 'USDT',
      equity,
      free: equity,
    },
    positions,
  };
};
