import { createCache } from '@yuants/cache';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import {
  defer,
  filter,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  repeat,
  retry,
  scan,
  share,
  shareReplay,
} from 'rxjs';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();
const OPEN_INTEREST_TTL = process.env.OPEN_INTEREST_TTL ? Number(process.env.OPEN_INTEREST_TTL) : 120_000;

const openInterestCache = createCache<number>(
  async (symbol: string) => {
    try {
      const data = await client.getFutureOpenInterest({ symbol });
      return Number(data.openInterest ?? 0);
    } catch (err) {
      console.warn('getFutureOpenInterest failed', symbol, err);
      return undefined;
    }
  },
  {
    expire: OPEN_INTEREST_TTL,
  },
);

const futurePremiumIndex$ = defer(() => client.getFuturePremiumIndex({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const futureBookTicker$ = defer(() => client.getFutureBookTicker({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quoteFromPremiumIndex$ = futurePremiumIndex$.pipe(
  mergeMap((entries) => from(entries || [])),
  map(
    (entry): Partial<IQuote> => ({
      datasource_id: 'BINANCE',
      product_id: encodePath('usdt-future', entry.symbol),
      last_price: entry.markPrice,
      updated_at: new Date(entry.time ?? Date.now()).toISOString(),
    }),
  ),
);

const quoteFromBookTicker$ = futureBookTicker$.pipe(
  mergeMap((entries) => from(entries || [])),
  map(
    (entry): Partial<IQuote> => ({
      datasource_id: 'BINANCE',
      product_id: encodePath('usdt-future', entry.symbol),
      bid_price: entry.bidPrice,
      ask_price: entry.askPrice,
      updated_at: new Date(entry.time ?? Date.now()).toISOString(),
    }),
  ),
);

const quoteFromOpenInterest$ = futureBookTicker$.pipe(
  mergeMap((entries) => from(entries || [])),
  mergeMap(
    (entry) =>
      from(openInterestCache.query(entry.symbol)).pipe(
        map(
          (openInterest): Partial<IQuote> => ({
            datasource_id: 'BINANCE',
            product_id: encodePath('usdt-future', entry.symbol),
            open_interest: `${openInterest ?? 0}`,
          }),
        ),
      ),
    5,
  ),
);

const quote$ = merge(quoteFromPremiumIndex$, quoteFromBookTicker$, quoteFromOpenInterest$).pipe(
  groupBy((quote) => quote.product_id),
  mergeMap((group$) =>
    group$.pipe(
      scan(
        (acc, cur) =>
          Object.assign(acc, cur, {
            datasource_id: 'BINANCE',
            product_id: group$.key,
          }),
        {} as Partial<IQuote>,
      ),
    ),
  ),
  share(),
  shareReplay({ bufferSize: 1, refCount: true }),
);

if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  quote$
    .pipe(
      writeToSQL({
        terminal,
        tableName: 'quote',
        writeInterval: 1_000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();

  terminal.channel.publishChannel('quote', { pattern: '^BINANCE/' }, (channel_id) => {
    const [datasourceId, productId] = decodePath(channel_id);
    if (!datasourceId || !productId) {
      throw new Error(`Invalid channel_id: ${channel_id}`);
    }
    return quote$.pipe(filter((quote) => quote.product_id === productId));
  });
}
