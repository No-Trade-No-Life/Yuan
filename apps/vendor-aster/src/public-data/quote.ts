import { createCache } from '@yuants/cache';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import { defer, filter, from, map, mergeMap, repeat, retry, shareReplay } from 'rxjs';
import { IQuote } from '@yuants/data-quote';
import { getFApiV1OpenInterest, getFApiV1TickerPrice } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();
const OPEN_INTEREST_TTL = process.env.OPEN_INTEREST_TTL ? Number(process.env.OPEN_INTEREST_TTL) : 120_000;

const openInterestCache = createCache<string>(
  async (symbol: string) => {
    try {
      const data = await getFApiV1OpenInterest({ symbol });
      return data.openInterest;
    } catch (error) {
      console.warn('getFApiV1OpenInterest failed', symbol, error);
      return undefined;
    }
  },
  { expire: OPEN_INTEREST_TTL },
);

const quote$ = defer(() => getFApiV1TickerPrice()).pipe(
  mergeMap((tickers) => tickers || []),
  mergeMap(
    (ticker) =>
      from(openInterestCache.query(ticker.symbol)).pipe(
        map(
          (openInterest): Partial<IQuote> => ({
            datasource_id: 'ASTER',
            product_id: encodePath('PERPETUAL', ticker.symbol),
            last_price: `${ticker.price}`,
            bid_price: `${ticker.price}`,
            ask_price: `${ticker.price}`,
            open_interest: `${openInterest ?? 0}`,
            updated_at: new Date(ticker.time ?? Date.now()).toISOString(),
          }),
        ),
      ),
    5,
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  quote$
    .pipe(
      writeToSQL({
        terminal,
        tableName: 'quote',
        writeInterval: 1000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

terminal.channel.publishChannel('quote', { pattern: '^ASTER/' }, (channel_id) => {
  const [datasourceId, productId] = decodePath(channel_id);
  if (!datasourceId || !productId) {
    throw new Error(`Invalid channel_id: ${channel_id}`);
  }
  return quote$.pipe(filter((quote) => quote.product_id === productId));
});
