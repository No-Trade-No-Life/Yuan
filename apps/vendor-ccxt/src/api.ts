import { formatTime } from '@yuants/data-model';
import ccxt, { Exchange } from 'ccxt';

const PUBLIC_ONLY = process.env.PUBLIC_ONLY === 'true';
export const EXCHANGE_ID = process.env.EXCHANGE_ID!;
const ACCOUNT_ID = process.env.ACCOUNT_ID!;
const CURRENCY = process.env.CURRENCY || 'USDT';

const CCXT_PARAMS = {
  apiKey: process.env.API_KEY,
  secret: process.env.SECRET,
  password: process.env.PASSWORD,
  httpProxy: process.env.HTTP_PROXY,
};
console.info(formatTime(Date.now()), 'init', EXCHANGE_ID, CCXT_PARAMS);
// @ts-ignore
export const ex: Exchange = new ccxt.pro[EXCHANGE_ID](CCXT_PARAMS);

console.info(
  formatTime(Date.now()),
  `FeatureCheck`,
  EXCHANGE_ID,
  JSON.stringify({
    fetchAccounts: !!ex.has['fetchAccounts'],
    fetchOHLCV: !!ex.has['fetchOHLCV'],
    watchOHLCV: !!ex.has['watchOHLCV'],
    fetchTicker: !!ex.has['fetchTicker'],
    watchTicker: !!ex.has['watchTicker'],
    fetchBalance: !!ex.has['fetchBalance'],
    watchBalance: !!ex.has['watchBalance'],
    fetchPositions: !!ex.has['fetchPositions'],
    watchPositions: !!ex.has['watchPositions'],
    fetchOpenOrders: !!ex.has['fetchOpenOrders'],
    fetchFundingRate: !!ex.has['fetchFundingRate'],
    fetchFundingRates: !!ex.has['fetchFundingRates'],
  }),
);
