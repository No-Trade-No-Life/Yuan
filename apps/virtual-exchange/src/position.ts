import { createCache } from '@yuants/cache';
import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { createClientProductCache } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { newError } from '@yuants/utils';

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

const interestRateIntervalCache = createCache(
  async (product_id: string) => {
    const sql = `select created_at from interest_rate where series_id = ${escapeSQL(
      product_id,
    )} order by created_at desc limit 2`;
    const rates = await requestSQL<{ created_at: string }[]>(terminal, sql);
    if (rates.length < 2) return undefined;
    const prev = new Date(rates[0].created_at).getTime();
    const prevOfPrev = new Date(rates[1].created_at).getTime();
    const interval = prev - prevOfPrev;
    return {
      prev,
      prevOfPrev,
      interval,
    };
  },
  { swrAfter: 3600_000, expire: 8 * 3600_000 },
);

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
        // 优先使用行情数据中的下一个结算时间
        pos.settlement_scheduled_at = new Date(quote.interest_rate_next_settled_at).getTime();
      } else if (quote.interest_rate_next_settled_at === null && interestRateInterval !== undefined) {
        // 估算下一个结算时间
        // 找到 prev + k * interval > now 的最小 k，则下一个结算时间为 prev + k * interval
        const k = Math.ceil((Date.now() - interestRateInterval.prev) / interestRateInterval.interval);
        pos.settlement_scheduled_at = interestRateInterval.prev + k * interestRateInterval.interval;
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
      pos.settlement_interval = interestRateInterval.interval;
    }
  }
  return positions;
};

export const polyfillOrders = async (orders: IOrder[]): Promise<IOrder[]> => {
  for (const order of orders) {
    const theProduct = await productCache.query(order.product_id);
    if (theProduct) {
      if (order.size !== undefined) {
        const sizeNum = +order.size;
        const sizeStep = theProduct.volume_step * theProduct.value_scale;
        if (!(sizeStep > 0)) throw newError('INVALID_SIZE_STEP', { product: theProduct, sizeStep });
        // check size is multiple of sizeStep
        if (Math.abs(sizeNum - Math.round(sizeNum / sizeStep) * sizeStep) > 1e-16) {
          throw newError('INVALID_ORDER_SIZE_NOT_MULTIPLE_OF_SIZE_STEP', {
            order,
            sizeStep,
            sizeNum,
            product: theProduct,
          });
        }

        if (sizeNum >= 0) {
          order.order_direction = order.is_close ? 'CLOSE_SHORT' : 'OPEN_LONG';
        } else {
          order.order_direction = order.is_close ? 'CLOSE_LONG' : 'OPEN_SHORT';
        }
        order.volume = Math.abs(sizeNum) / theProduct.value_scale;
      }
    }
  }
  return orders;
};
