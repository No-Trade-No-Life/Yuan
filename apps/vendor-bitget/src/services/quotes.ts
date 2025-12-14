import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, formatTime, newError } from '@yuants/utils';
import {
  getCurrentFundingRate,
  getTickers,
  type IUtaCurrentFundingRate,
  type IUtaTicker,
} from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const shouldInclude = (product_ids: string[] | undefined) => {
  const productIdSet = new Set(product_ids ?? []);
  return productIdSet.size === 0 ? () => true : (product_id: string) => productIdSet.has(product_id);
};

const mapTickerToQuote = (category: 'USDT-FUTURES' | 'COIN-FUTURES') => (ticker: IUtaTicker) => ({
  product_id: encodePath('BITGET', category, ticker.symbol),
  updated_at: ticker.ts ? Number(ticker.ts) : Date.now(),
  last_price: ticker.lastPrice,
  ask_price: ticker.ask1Price,
  ask_volume: ticker.ask1Size,
  bid_price: ticker.bid1Price,
  bid_volume: ticker.bid1Size,
  interest_rate_long: ticker.fundingRate ? `${-Number(ticker.fundingRate)}` : '0',
  interest_rate_short: ticker.fundingRate ?? '0',
  open_interest: ticker.openInterest ?? '0',
});

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BITGET/USDT-FUTURES/',
    fields: [
      'last_price',
      'ask_price',
      'ask_volume',
      'bid_price',
      'bid_volume',
      'interest_rate_long',
      'interest_rate_short',
      'open_interest',
    ],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const res = await getTickers({ category: 'USDT-FUTURES' });
    return (res.data ?? [])
      .map(mapTickerToQuote('USDT-FUTURES'))
      .filter((quote) => include(quote.product_id));
  },
);

const createFundingTimeQuoteService = (category: 'USDT-FUTURES' | 'COIN-FUTURES') => {
  provideQuoteService(
    terminal,
    {
      product_id_prefix: `BITGET/${category}/`,
      fields: ['interest_rate_next_settled_at', 'interest_rate_prev_settled_at'],
      max_products_per_request: 1,
    },
    async (req) => {
      const [product_id] = req.product_ids;
      if (!product_id) return [];

      const [, , symbol] = decodePath(product_id);

      const res = await getCurrentFundingRate({ symbol });
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }

      const data: IUtaCurrentFundingRate | undefined = res.data?.[0];
      if (!data?.nextUpdate || !data.fundingRateInterval) {
        throw newError('BITGET_FUNDING_RATE_DATA_INVALID', { product_id, res });
      }

      const nextUpdateTs = Number(data.nextUpdate);
      const intervalHours = Number(data.fundingRateInterval);
      const prevUpdateTs = nextUpdateTs - intervalHours * 3600_000;

      return [
        {
          product_id,
          updated_at: Date.now(),
          interest_rate_next_settled_at: formatTime(nextUpdateTs),
          interest_rate_prev_settled_at: formatTime(prevUpdateTs),
        },
      ];
    },
  );
};

createFundingTimeQuoteService('USDT-FUTURES');
createFundingTimeQuoteService('COIN-FUTURES');

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BITGET/COIN-FUTURES/',
    fields: [
      'last_price',
      'ask_price',
      'ask_volume',
      'bid_price',
      'bid_volume',
      'interest_rate_long',
      'interest_rate_short',
      'open_interest',
    ],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const res = await getTickers({ category: 'COIN-FUTURES' });
    return (res.data ?? [])
      .map(mapTickerToQuote('COIN-FUTURES'))
      .filter((quote) => include(quote.product_id));
  },
);
