import { createCache } from '@yuants/cache';
import { IQuote, setMetricsQuoteState } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import {
  catchError,
  combineLatest,
  concatMap,
  defer,
  exhaustMap,
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
  share,
  shareReplay,
  tap,
  timer,
} from 'rxjs';
import { getMarginAllPairs, getMarginNextHourlyInterestRate, IMarginPair } from '../api/private-api';
import {
  getFutureBookTicker,
  getFutureExchangeInfo,
  getFutureOpenInterest,
  getFuturePremiumIndex,
  getSpotBookTicker,
  getSpotExchangeInfo,
  getSpotTickerPrice,
} from '../api/public-api';

const terminal = Terminal.fromNodeEnv();
const DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS = 500;
const DEFAULT_MARGIN_RATE_REQUEST_INTERVAL_MS = 500;
const OPEN_INTEREST_TTL = process.env.OPEN_INTEREST_TTL ? Number(process.env.OPEN_INTEREST_TTL) : 300_000;

interface IRateLimit {
  rateLimitType?: string;
  interval?: string;
  intervalNum?: number;
  limit?: number;
}

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

const getRequestIntervalMs = (rateLimits: IRateLimit[] | undefined, fallbackMs: number) => {
  const intervals: number[] = [];
  for (const item of rateLimits ?? []) {
    if (item.rateLimitType !== 'REQUEST_WEIGHT' && item.rateLimitType !== 'RAW_REQUESTS') continue;
    const duration = toIntervalMs(item.interval, item.intervalNum);
    console.info('!!!!!', item, duration);
    const limit = item.limit;
    if (duration == null || limit == null || limit <= 0) continue;
    intervals.push(Math.ceil(duration / limit));
  }
  console.info('!!!!!', intervals);
  if (!intervals.length) return fallbackMs;
  return Math.max(fallbackMs, Math.max(...intervals));
};

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

const futureRequestInterval$ = defer(() => getFutureExchangeInfo()).pipe(
  map((info) => getRequestIntervalMs(info.rateLimits, DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS)),
  catchError((err) => {
    console.warn('getFutureExchangeInfo failed when calculating request interval', err);
    return of(DEFAULT_OPEN_INTEREST_REQUEST_INTERVAL_MS);
  }),
  retry({ delay: 60_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
  tap((v) => {
    console.info(`!!!!Determined future request interval: ${v} ms`);
  }),
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

const quoteFromSpotTicker$ = defer(() => getSpotTickerPrice({})).pipe(
  mergeMap((entries) => from(entries || [])),
  mergeMap((entry): Partial<IQuote>[] => [
    {
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'SPOT', entry.symbol),
      last_price: entry.price,
      updated_at: formatTime(Date.now()),
    },
    {
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'MARGIN', entry.symbol),
      last_price: entry.price,
      updated_at: formatTime(Date.now()),
    },
  ]),
  repeat({ delay: 1_000 }),
  retry({ delay: 1_000 }),
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

const quoteFromOpenInterest$ = combineLatest([futureBookTicker$, futureRequestInterval$]).pipe(
  exhaustMap(([entries, requestInterval]) =>
    from(entries || []).pipe(
      concatMap((entry, index) =>
        (index > 0 ? timer(requestInterval) : of(0)).pipe(
          mergeMap(() => from(openInterestCache.query(entry.symbol))),
          map(
            (openInterest): Partial<IQuote> => ({
              datasource_id: 'BINANCE',
              product_id: encodePath('BINANCE', 'USDT-FUTURE', entry.symbol),
              open_interest: `${openInterest ?? 0}`,
            }),
          ),
        ),
      ),
    ),
  ),
);

const quoteFromSpotBookTicker$ = defer(() => getSpotBookTicker({})).pipe(
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
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
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
  map((pairs) => {
    if (!Array.isArray(pairs)) {
      console.warn('getMarginAllPairs returned non-array payload', pairs);
      return [];
    }
    return pairs;
  }),
  catchError((err) => {
    console.warn('getMarginAllPairs failed', err);
    return of([] as IMarginPair[]);
  }),
  repeat({ delay: 3600_000 }), // Refresh pair list hourly
  retry({ delay: 60_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const spotRequestInterval$ = defer(() => getSpotExchangeInfo()).pipe(
  map((info) => getRequestIntervalMs(info.rateLimits, DEFAULT_MARGIN_RATE_REQUEST_INTERVAL_MS)),
  catchError((err) => {
    console.warn('getSpotExchangeInfo failed when calculating request interval', err);
    return of(DEFAULT_MARGIN_RATE_REQUEST_INTERVAL_MS);
  }),
  retry({ delay: 60_000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
  tap((v) => {
    console.info(`!!!!Determined spot request interval: ${v} ms`);
  }),
);

const quoteFromMarginRates$ = combineLatest([marginPairs$, spotRequestInterval$]).pipe(
  mergeMap(([pairs, requestInterval]) =>
    from(pairs).pipe(
      concatMap((pair, index) =>
        (index > 0 ? timer(requestInterval) : of(0)).pipe(
          mergeMap(() => from(marginInterestRateCache.query(pair.base))),
          mergeMap((baseRate) =>
            timer(requestInterval).pipe(
              mergeMap(() => from(marginInterestRateCache.query(pair.quote))),
              map(
                (quoteRate): Partial<IQuote> => ({
                  datasource_id: 'BINANCE',
                  product_id: encodePath('BINANCE', 'SPOT', pair.symbol),
                  // User instruction: Long = Quote Rate, Short = Base Rate
                  interest_rate_long: quoteRate,
                  interest_rate_short: baseRate,
                  updated_at: formatTime(Date.now()),
                }),
              ),
            ),
          ),
        ),
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
  quoteFromSpotTicker$,
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
      setMetricsQuoteState(terminal.terminal_id),
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
