import { createCache } from '@yuants/cache';
import type { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import {
  catchError,
  combineLatest,
  concatMap,
  defer,
  filter,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  repeat,
  retry,
  scan,
  shareReplay,
  startWith,
  timer,
} from 'rxjs';
import {
  getFApiV1ExchangeInfo,
  getFApiV1OpenInterest,
  getFApiV1TickerPrice,
  IAsterRateLimit,
} from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();
const DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS = 500;
const OPEN_INTEREST_TTL = process.env.OPEN_INTEREST_TTL ? Number(process.env.OPEN_INTEREST_TTL) : 120_000;

const toIntervalMs = (interval?: string, intervalNum?: number) => {
  switch (interval) {
    case 'SECOND':
      return (intervalNum ?? 1) * 1_000;
    case 'MINUTE':
      return (intervalNum ?? 1) * 60_000;
    case 'HOUR':
      return (intervalNum ?? 1) * 3_600_000;
    case 'DAY':
      return (intervalNum ?? 1) * 86_400_000;
    default:
      return undefined;
  }
};

const getRequestIntervalMs = (rateLimits: IAsterRateLimit[] | undefined, fallbackMs: number) => {
  const intervals: number[] = [];
  for (const item of rateLimits ?? []) {
    if (item.rateLimitType !== 'REQUEST_WEIGHT' && item.rateLimitType !== 'RAW_REQUESTS') continue;
    const duration = toIntervalMs(item.interval, item.intervalNum);
    const limit = item.limit;
    if (duration == null || limit == null || limit <= 0) continue;
    intervals.push(Math.ceil(duration / limit));
  }
  if (!intervals.length) return fallbackMs;
  return Math.max(fallbackMs, Math.max(...intervals));
};

// const openInterestCache = createCache<string>(
//   async (symbol: string) => {
//     try {
//       const data = await getFApiV1OpenInterest({ symbol });
//       return data.openInterest;
//     } catch (error) {
//       console.warn('getFApiV1OpenInterest failed', symbol, error);
//       return undefined;
//     }
//   },
//   { expire: OPEN_INTEREST_TTL },
// );

// const requestInterval$ = defer(() => getFApiV1ExchangeInfo({})).pipe(
//   map((info) => getRequestIntervalMs(info.rateLimits, DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS)),
//   catchError((err) => {
//     console.warn('getFApiV1ExchangeInfo failed when calculating request interval', err);
//     return of(DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS);
//   }),
//   startWith(DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS),
//   retry({ delay: 60_000 }),
//   shareReplay({ bufferSize: 1, refCount: true }),
// );

const ticker$ = defer(() => getFApiV1TickerPrice({})).pipe(
  map((tickers) => (Array.isArray(tickers) ? tickers : [])),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quoteFromTicker$ = ticker$.pipe(
  mergeMap((tickers) => tickers || []),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'ASTER',
      product_id: encodePath('ASTER', 'PERP', ticker.symbol),
      last_price: `${ticker.price}`,
      bid_price: `${ticker.price}`,
      ask_price: `${ticker.price}`,
      updated_at: new Date(ticker.time ?? Date.now()).toISOString(),
    }),
  ),
);

// const quoteFromOpenInterest$ = combineLatest([ticker$, requestInterval$]).pipe(
//   mergeMap(([tickers, requestInterval]) =>
//     from(tickers).pipe(
//       concatMap((ticker, index) =>
//         (index > 0 ? timer(requestInterval) : of(0)).pipe(
//           mergeMap(() => from(openInterestCache.query(ticker.symbol))),
//           map(
//             (openInterest): Partial<IQuote> => ({
//               datasource_id: 'ASTER',
//               product_id: encodePath('ASTER', 'PERP', ticker.symbol),
//               open_interest: `${openInterest ?? 0}`,
//               updated_at: new Date(ticker.time ?? Date.now()).toISOString(),
//             }),
//           ),
//         ),
//       ),
//     ),
//   ),
// );

const quote$ = merge(
  quoteFromTicker$,
  // quoteFromOpenInterest$
).pipe(
  groupBy((quote) => quote.product_id),
  mergeMap((group$) =>
    group$.pipe(
      scan(
        (acc, cur) =>
          Object.assign(acc, cur, {
            datasource_id: 'ASTER',
            product_id: group$.key,
          }),
        {} as Partial<IQuote>,
      ),
    ),
  ),
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

  terminal.channel.publishChannel('quote', { pattern: '^ASTER/' }, (channel_id) => {
    const [datasourceId, productId] = decodePath(channel_id);
    if (!datasourceId || !productId) {
      throw new Error(`Invalid channel_id: ${channel_id}`);
    }
    return quote$.pipe(filter((quote) => quote.product_id === productId));
  });
}
