import { createCache } from '@yuants/cache';
import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { createClientProductCache } from '@yuants/data-product';
import { IQuote, queryQuotes } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { newError } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();
const productCache = createClientProductCache(terminal);

const quoteCache = createCache<Partial<IQuote> | undefined>(
  async (product_id) => {
    const quoteRecord = await queryQuotes(
      terminal,
      [product_id],
      [
        'ask_price',
        'bid_price',
        'last_price',
        'interest_rate_long',
        'interest_rate_short',
        'interest_rate_prev_settled_at',
        'interest_rate_next_settled_at',
      ],
      Date.now(),
    );
    return quoteRecord[product_id];
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
  { swrAfter: 60_000, expire: 3600_000 },
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

    if (quote && pos.size) {
      const sizeNum = +pos.size;
      if (pos.current_price === undefined) {
        if (sizeNum > 0) {
          // 多头头寸使用买一价作为可平仓价格，如果没有买一价则使用最新价
          pos.current_price = (quote.ask_price || quote.last_price) + '';
        } else {
          // 空头头寸使用卖一价作为可平仓价格，如果没有卖一价则使用最新价
          pos.current_price = (quote.bid_price || quote.last_price) + '';
        }
      }

      // 计算名义价值
      if (pos.notional === undefined) {
        pos.notional = sizeNum * (+pos.current_price || 0) + '';
      }
    }

    // 利率相关信息的追加
    if (quote) {
      if (quote.interest_rate_next_settled_at != null) {
        const nextSettledAt = new Date(quote.interest_rate_next_settled_at).getTime();
        // 优先使用行情数据中的下一个结算时间
        pos.settlement_scheduled_at = nextSettledAt;
        // 优先使用下一个结算时间推算结算间隔
        if (interestRateInterval !== undefined) {
          const interval = nextSettledAt - interestRateInterval.prev;
          pos.settlement_interval = interval;
        }
      } else if (quote.interest_rate_next_settled_at == null && interestRateInterval !== undefined) {
        // 估算下一个结算时间
        // 找到 prev + k * interval > now 的最小 k，则下一个结算时间为 prev + k * interval
        const k = Math.ceil((Date.now() - interestRateInterval.prev) / interestRateInterval.interval);
        pos.settlement_scheduled_at = interestRateInterval.prev + k * interestRateInterval.interval;
      }

      // 如果还没有结算间隔，则使用 interest rate 表的时间间隔作为结算间隔
      if (pos.settlement_interval === undefined && interestRateInterval) {
        pos.settlement_interval = interestRateInterval.interval;
      }

      if (pos.direction === 'LONG') {
        if (quote.interest_rate_long != null) {
          pos.interest_to_settle = +quote.interest_rate_long * pos.valuation;
        }
      }
      if (pos.direction === 'SHORT') {
        if (quote.interest_rate_short != null) {
          pos.interest_to_settle = +quote.interest_rate_short * pos.valuation;
        }
      }
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
