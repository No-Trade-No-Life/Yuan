import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import {
  getFutureBookTicker,
  getFutureOpenInterest,
  getFuturePremiumIndex,
  getSpotBookTicker,
  getSpotTickerPrice,
} from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const shouldInclude = (product_ids: string[] | undefined) => {
  const productIdSet = new Set(product_ids ?? []);
  return productIdSet.size === 0 ? () => true : (product_id: string) => productIdSet.has(product_id);
};

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/USDT-FUTURE/',
    fields: ['bid_price', 'ask_price', 'bid_volume', 'ask_volume'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const entries = await getFutureBookTicker({});
    return (entries ?? [])
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
        updated_at: entry.time ?? Date.now(),
        bid_price: entry.bidPrice,
        ask_price: entry.askPrice,
        bid_volume: entry.bidQty,
        ask_volume: entry.askQty,
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/USDT-FUTURE/',
    fields: ['last_price', 'interest_rate_long', 'interest_rate_short', 'interest_rate_next_settled_at'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const entries = await getFuturePremiumIndex({});
    return (entries ?? [])
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
        updated_at: entry.time ?? Date.now(),
        last_price: entry.markPrice,
        interest_rate_long: `${-Number(entry.lastFundingRate)}`,
        interest_rate_short: `${Number(entry.lastFundingRate)}`,
        interest_rate_next_settled_at: formatTime(entry.nextFundingTime),
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/USDT-FUTURE/',
    fields: ['open_interest'],
    max_products_per_request: 1,
  },
  async (req) => {
    const [product_id] = req.product_ids;
    if (!product_id) return [];

    const [, , symbol] = decodePath(product_id);

    const res = await getFutureOpenInterest({ symbol });
    return [
      {
        product_id,
        updated_at: res.time,
        open_interest: res.openInterest,
      },
    ];
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/SPOT/',
    fields: ['bid_price', 'ask_price', 'bid_volume', 'ask_volume'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const entries = await getSpotBookTicker({});
    const updated_at = Date.now();
    return (entries ?? [])
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'SPOT', entry.symbol),
        updated_at,
        bid_price: entry.bidPrice,
        ask_price: entry.askPrice,
        bid_volume: entry.bidQty,
        ask_volume: entry.askQty,
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/MARGIN/',
    fields: ['bid_price', 'ask_price', 'bid_volume', 'ask_volume'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const entries = await getSpotBookTicker({});
    const updated_at = Date.now();
    return (entries ?? [])
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'MARGIN', entry.symbol),
        updated_at,
        bid_price: entry.bidPrice,
        ask_price: entry.askPrice,
        bid_volume: entry.bidQty,
        ask_volume: entry.askQty,
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/SPOT/',
    fields: ['last_price'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const res = await getSpotTickerPrice({});
    const entries = Array.isArray(res) ? res : [res];
    const updated_at = Date.now();
    return entries
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'SPOT', entry.symbol),
        updated_at,
        last_price: entry.price,
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'BINANCE/MARGIN/',
    fields: ['last_price'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const res = await getSpotTickerPrice({});
    const entries = Array.isArray(res) ? res : [res];
    const updated_at = Date.now();
    return entries
      .map((entry) => ({
        product_id: encodePath('BINANCE', 'MARGIN', entry.symbol),
        updated_at,
        last_price: entry.price,
      }))
      .filter((quote) => include(quote.product_id));
  },
);
