import { createCache } from '@yuants/cache';
import { IPosition } from '@yuants/data-account';
import { createClientProductCache } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';

const terminal = Terminal.fromNodeEnv();
const productCache = createClientProductCache(terminal);
const quoteCache = createCache<IQuote>(
  async (product_id) => {
    const sql = `select * from quote where product_id = ${escapeSQL(product_id)}`;
    const [quote] = await requestSQL<IQuote[]>(terminal, sql);
    return quote;
  },
  { expire: 30_000 },
);

const interestRateIntervalCache = createCache(async (product_id: string) => {
  const sql = `select created_at from interest_rate where series_id = ${escapeSQL(
    product_id,
  )} order by created_at desc limit 2`;
  const rates = await requestSQL<{ created_at: string }[]>(terminal, sql);
  if (rates.length < 2) return undefined;
  return new Date(rates[0].created_at).getTime() - new Date(rates[1].created_at).getTime();
});

export const polyfillPosition = async (positions: IPosition[]): Promise<IPosition[]> => {
  // TODO: 使用 batch query SQL 优化 product / quote 查询性能
  for (const pos of positions) {
    const [theProduct, quote, interestRateInterval] = await Promise.all([
      productCache.query(pos.product_id),
      quoteCache.query(pos.product_id),
      interestRateIntervalCache.query(pos.product_id),
    ]);

    // 估值 = value_scale * volume * closable_price
    if (theProduct) {
      if (theProduct.base_currency) {
        pos.base_currency = theProduct.base_currency;
      }
      if (theProduct.quote_currency) {
        pos.quote_currency = theProduct.quote_currency;
      }
      if (pos.size === undefined && pos.volume !== undefined && pos.direction !== undefined) {
        pos.size = (pos.direction === 'LONG' ? 1 : -1) * pos.volume * (theProduct.value_scale || 1) + '';
      }
      if (pos.free_size === undefined && pos.free_volume !== undefined && pos.direction !== undefined) {
        pos.free_size =
          (pos.direction === 'LONG' ? 1 : -1) * pos.free_volume * (theProduct.value_scale || 1) + '';
      }
      pos.valuation = Math.abs((theProduct.value_scale || 1) * pos.volume * pos.closable_price);
    }

    // 利率相关信息的追加
    if (quote) {
      if (quote.interest_rate_next_settled_at !== null) {
        pos.settlement_scheduled_at = new Date(quote.interest_rate_next_settled_at).getTime();
      }
      if (pos.direction === 'LONG') {
        if (quote.interest_rate_long !== null) {
          pos.interest_to_settle = +quote.interest_rate_long * pos.valuation;
        }
      }
      if (pos.direction === 'SHORT') {
        if (quote.interest_rate_short !== null) {
          pos.interest_to_settle = +quote.interest_rate_short * pos.valuation;
        }
      }
    }

    if (interestRateInterval) {
      pos.settlement_interval = interestRateInterval;
    }
  }
  return positions;
};
