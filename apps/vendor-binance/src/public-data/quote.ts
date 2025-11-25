import { createCache } from '@yuants/cache';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
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
import { getMarginAllPairs, getMarginNextHourlyInterestRate, IMarginPair } from '../api/private-api';
import {
  getFutureBookTicker,
  getFutureOpenInterest,
  getFuturePremiumIndex,
  getSpotBookTicker,
} from '../api/public-api';

const terminal = Terminal.fromNodeEnv();
const OPEN_INTEREST_TTL = process.env.OPEN_INTEREST_TTL ? Number(process.env.OPEN_INTEREST_TTL) : 120_000;

const openInterestCache = createCache<number>(
  async (symbol: string) => {
    try {
      const data = await getFutureOpenInterest({ symbol });
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

const futurePremiumIndex$ = defer(() => getFuturePremiumIndex({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const futureBookTicker$ = defer(() => getFutureBookTicker({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quoteFromPremiumIndex$ = futurePremiumIndex$.pipe(
  mergeMap((entries) => from(entries || [])),
  map(
    (entry): Partial<IQuote> => ({
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
      last_price: entry.markPrice,
      // Use the latest funding rate so that long pays when fundingRate > 0
      interest_rate_long: `${-Number(entry.lastFundingRate)}`,
      interest_rate_short: entry.lastFundingRate,
      interest_rate_next_settled_at: formatTime(entry.nextFundingTime),
      updated_at: formatTime(entry.time ?? Date.now()),
    }),
  ),
);

const quoteFromBookTicker$ = futureBookTicker$.pipe(
  mergeMap((entries) => from(entries || [])),
  map(
    (entry): Partial<IQuote> => ({
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
      bid_price: entry.bidPrice,
      ask_price: entry.askPrice,
      updated_at: formatTime(entry.time ?? Date.now()),
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
            product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
            open_interest: `${openInterest ?? 0}`,
          }),
        ),
      ),
    5,
  ),
);

const quoteFromSpotBookTicker$ = defer(() => getSpotBookTicker({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
  mergeMap((entries) => from(entries || [])),
  map(
    (entry): Partial<IQuote> => ({
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'SPOT', entry.symbol),
      bid_price: entry.bidPrice,
      ask_price: entry.askPrice,
      bid_volume: entry.bidQty,
      ask_volume: entry.askQty,
      updated_at: formatTime(Date.now()),
    }),
  ),
);

const marginInterestRateCache = createCache<string>(
  async (asset: string) => {
    try {
      const data = await getMarginNextHourlyInterestRate({
        assets: asset,
        isIsolated: false,
      });
      return data[0]?.nextHourlyInterestRate;
    } catch (err) {
      return undefined;
    }
  },
  {
    expire: 60_000,
  },
);

const marginPairs$ = defer(() => getMarginAllPairs()).pipe(
  repeat({ delay: 3600_000 }), // Refresh pair list hourly
  retry({ delay: 60_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quoteFromMarginRates$ = marginPairs$.pipe(
  mergeMap((pairs: IMarginPair[]) =>
    from(pairs).pipe(
      mergeMap(
        (pair) =>
          defer(async () => {
            const [baseRate, quoteRate] = await Promise.all([
              marginInterestRateCache.query(pair.base),
              marginInterestRateCache.query(pair.quote),
            ]);
            return {
              datasource_id: 'BINANCE',
              product_id: encodePath('BINANCE', 'SPOT', pair.symbol),
              // User instruction: Long = Quote Rate, Short = Base Rate
              interest_rate_long: quoteRate,
              interest_rate_short: baseRate,
              updated_at: formatTime(Date.now()),
            } as Partial<IQuote>;
          }),
        5, // Concurrency
      ),
    ),
  ),
  repeat({ delay: 60_000 }),
);

const quote$ = merge(
  quoteFromPremiumIndex$,
  quoteFromBookTicker$,
  quoteFromOpenInterest$,
  quoteFromSpotBookTicker$,
  quoteFromMarginRates$,
).pipe(
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
