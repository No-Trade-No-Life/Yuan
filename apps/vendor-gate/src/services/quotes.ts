import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getFuturesTickers, getSpotTickers } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'GATE/FUTURE/',
    fields: [
      'last_price',
      'ask_price',
      'bid_price',
      'open_interest',
      'interest_rate_long',
      'interest_rate_short',
    ],
  },
  async () => {
    const res = await getFuturesTickers('usdt', {});
    return res.map((ticker) => ({
      product_id: encodePath('GATE', 'FUTURE', ticker.contract),
      updated_at: Date.now(), // ISSUE: API 未返回服务器时间
      last_price: ticker.last,
      ask_price: ticker.lowest_ask,
      bid_price: ticker.highest_bid,
      // total_size is the open interest
      open_interest: ticker.total_size,
      // funding_rate is the current funding rate
      interest_rate_long: `${-Number(ticker.funding_rate)}`,
      interest_rate_short: ticker.funding_rate,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'GATE/SPOT/',
    fields: ['last_price', 'ask_price', 'ask_volume', 'bid_price', 'bid_volume', 'open_interest'],
  },
  async () => {
    const res = await getSpotTickers({});
    return res.map((ticker) => ({
      product_id: encodePath('GATE', 'SPOT', ticker.currency_pair),
      updated_at: Date.now(),
      last_price: ticker.last,
      ask_price: ticker.lowest_ask,
      bid_price: ticker.highest_bid,
      ask_volume: ticker.lowest_size ?? '0',
      bid_volume: ticker.highest_size ?? '0',
      // 现货没有持仓量的概念，设置为0
      open_interest: '0',
    }));
  },
);
