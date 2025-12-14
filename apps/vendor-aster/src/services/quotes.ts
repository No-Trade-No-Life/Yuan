import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { getFApiV1OpenInterest, getFApiV1PremiumIndex, getFApiV1TickerPrice } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const shouldInclude = (product_ids: string[] | undefined) => {
  const productIdSet = new Set(product_ids ?? []);
  return productIdSet.size === 0 ? () => true : (product_id: string) => productIdSet.has(product_id);
};

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'ASTER/PERP/',
    fields: ['last_price', 'bid_price', 'ask_price'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const entries = await getFApiV1TickerPrice({});
    return (entries ?? [])
      .map((entry) => ({
        product_id: encodePath('ASTER', 'PERP', entry.symbol),
        updated_at: entry.time ?? Date.now(),
        last_price: `${entry.price}`,
        bid_price: `${entry.price}`,
        ask_price: `${entry.price}`,
      }))
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'ASTER/PERP/',
    fields: ['interest_rate_long', 'interest_rate_short', 'interest_rate_next_settled_at'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const res = await getFApiV1PremiumIndex({});
    const entries = Array.isArray(res) ? res : [res];
    return entries
      .map((entry) => ({
        product_id: encodePath('ASTER', 'PERP', entry.symbol),
        updated_at: entry.time ?? Date.now(),
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
    product_id_prefix: 'ASTER/PERP/',
    fields: ['open_interest'],
    max_products_per_request: 1,
  },
  async (req) => {
    const [product_id] = req.product_ids;
    if (!product_id) return [];

    const [, , symbol] = decodePath(product_id);
    const res = await getFApiV1OpenInterest({ symbol });
    return [
      {
        product_id,
        updated_at: res.time,
        open_interest: res.openInterest,
      },
    ];
  },
);
