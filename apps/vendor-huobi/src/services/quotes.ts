import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import {
  getSpotMarketTickers,
  getSwapBatchFundingRate,
  getSwapMarketBbo,
  getSwapMarketTrade,
  getSwapOpenInterest,
} from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HTX/SWAP/',
    fields: ['ask_price', 'ask_volume', 'bid_price', 'bid_volume'],
  },
  async () => {
    const res = await getSwapMarketBbo({});
    const updated_at = Date.now();
    return (res.ticks ?? []).map((tick) => {
      const [ask_price = '', ask_volume = ''] = tick.ask || [];
      const [bid_price = '', bid_volume = ''] = tick.bid || [];
      return {
        product_id: encodePath('HTX', 'SWAP', tick.contract_code),
        updated_at,
        ask_price: `${ask_price}`,
        ask_volume: `${ask_volume}`,
        bid_price: `${bid_price}`,
        bid_volume: `${bid_volume}`,
      };
    });
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HTX/SWAP/',
    fields: ['last_price'],
  },
  async () => {
    const res = await getSwapMarketTrade({});
    const updated_at = Date.now();
    return (res.tick?.data ?? []).map((tick) => ({
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      updated_at,
      last_price: `${tick.price}`,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HTX/SWAP/',
    fields: ['interest_rate_long', 'interest_rate_short', 'interest_rate_next_settled_at'],
  },
  async (req) => {
    const res = await getSwapBatchFundingRate({});
    const updated_at = Date.now();
    return (res.data ?? []).map((tick) => ({
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      updated_at,
      interest_rate_long: `${-Number(tick.funding_rate)}`,
      interest_rate_short: `${Number(tick.funding_rate)}`,
      interest_rate_next_settled_at: formatTime(+tick.funding_time),
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HTX/SWAP/',
    fields: ['open_interest'],
  },
  async (req) => {
    const res = await getSwapOpenInterest({});
    const updated_at = Date.now();
    return (res.data ?? []).map((tick) => ({
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      updated_at,
      open_interest: `${tick.volume}`,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HTX/SPOT/',
    fields: ['last_price', 'ask_price', 'ask_volume', 'bid_price', 'bid_volume'],
  },
  async () => {
    const res = await getSpotMarketTickers();
    const updated_at = Date.now();
    return (res.data ?? []).map((tick) => ({
      product_id: encodePath('HTX', 'SPOT', tick.symbol),
      updated_at,
      ask_price: `${tick.ask}`,
      bid_price: `${tick.bid}`,
      ask_volume: `${tick.askSize}`,
      bid_volume: `${tick.bidSize}`,
      last_price: `${tick.close}`,
    }));
  },
);
