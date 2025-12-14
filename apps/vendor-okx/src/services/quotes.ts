import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getMarketTickers, getOpenInterest } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const normalizeUpdatedAt = (ts?: string) => (ts ? Number(ts) : Date.now());

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'OKX/SWAP/',
    fields: ['last_price', 'ask_price', 'ask_volume', 'bid_price', 'bid_volume'],
  },
  async () => {
    const res = await getMarketTickers({ instType: 'SWAP' });
    return (res.data ?? []).map((ticker) => ({
      product_id: encodePath('OKX', 'SWAP', ticker.instId),
      updated_at: normalizeUpdatedAt(ticker.ts),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      ask_volume: ticker.askSz,
      bid_price: ticker.bidPx,
      bid_volume: ticker.bidSz,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'OKX/SPOT/',
    fields: ['last_price', 'ask_price', 'ask_volume', 'bid_price', 'bid_volume'],
  },
  async () => {
    const res = await getMarketTickers({ instType: 'SPOT' });
    return (res.data ?? []).map((ticker) => ({
      product_id: encodePath('OKX', 'SPOT', ticker.instId),
      updated_at: normalizeUpdatedAt(ticker.ts),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      ask_volume: ticker.askSz,
      bid_price: ticker.bidPx,
      bid_volume: ticker.bidSz,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'OKX/MARGIN/',
    fields: ['last_price', 'ask_price', 'ask_volume', 'bid_price', 'bid_volume'],
  },
  async () => {
    const res = await getMarketTickers({ instType: 'SPOT' });
    return (res.data ?? []).map((ticker) => ({
      product_id: encodePath('OKX', 'MARGIN', ticker.instId),
      updated_at: normalizeUpdatedAt(ticker.ts),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      ask_volume: ticker.askSz,
      bid_price: ticker.bidPx,
      bid_volume: ticker.bidSz,
    }));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'OKX/SWAP/',
    fields: ['open_interest'],
  },
  async () => {
    const res = await getOpenInterest({ instType: 'SWAP' });
    return (res.data ?? []).map((entry) => ({
      product_id: encodePath('OKX', 'SWAP', entry.instId),
      updated_at: normalizeUpdatedAt(entry.ts),
      open_interest: entry.oi ?? '0',
    }));
  },
);
