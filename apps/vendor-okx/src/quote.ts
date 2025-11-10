import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, listWatch } from '@yuants/utils';
import {
  catchError,
  defer,
  EMPTY,
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
  tap,
  toArray,
} from 'rxjs';
import { getInstruments, getMarketTickers, getOpenInterest } from './public-api';
import { useOpenInterest, useTicker } from './ws';
// import { useOpenInterest, useTicker } from './websocket';

const swapInstruments$ = defer(() => getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);
const spotInstruments$ = defer(() => getInstruments({ instType: 'SPOT' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);

const spotTickers$ = defer(() => getMarketTickers({ instType: 'SPOT' })).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

// depend by SubmitOrders
export const spotMarketTickers$ = defer(() => spotTickers$).pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      map((x) => [x.instId, x] as const),
      toArray(),
      map((x) => Object.fromEntries(x)),
    ),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const spotTicker$ = spotInstruments$.pipe(
  tap((x) => {
    console.info('SPOT INSTRUMENTS', x.length);
  }),
  listWatch(
    (x) => x.instId,
    (x) => useTicker(x.instId),
    () => true,
  ),
  share(),
);

const quoteOfSwapFromRest$ = defer(() => getMarketTickers({ instType: 'SWAP' })).pipe(
  mergeMap((x) => x.data || []),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath(x.instType, x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    }),
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
);

const quoteOfSpotAndMarginFromRest$ = defer(() => getMarketTickers({ instType: 'SPOT' })).pipe(
  mergeMap((x) => x.data || []),
  mergeMap((x): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('SPOT', x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('MARGIN', x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    },
  ]),
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
);

const quoteOfSwapFromWs$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => useTicker(x.instId),
    () => true,
  ),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    }),
  ),
);

const quoteOfSpotAndMarginFromWs$ = spotTicker$.pipe(
  mergeMap((ticker): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('SPOT', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('MARGIN', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    },
  ]),
);

const swapOpenInterests$ = defer(() => getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const interestRateOfSwapFromWS$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => useOpenInterest(x.instId),
    () => true,
  ),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', x[0].instId),
      open_interest: x[0].oi,
    }),
  ),
  share(),
);

const quoteSources$ = [
  quoteOfSwapFromWs$,
  interestRateOfSwapFromWS$,
  quoteOfSwapFromRest$,
  quoteOfSpotAndMarginFromWs$,
  quoteOfSpotAndMarginFromRest$,
];

const quote$ = defer(() =>
  merge(
    ...quoteSources$.map((x$) =>
      defer(() => x$).pipe(
        // 防止单个流关闭导致整体关闭
        catchError(() => EMPTY),
      ),
    ),
  ),
).pipe(
  groupBy((x) => encodePath(x.datasource_id, x.product_id)),
  mergeMap((group$) => {
    return group$.pipe(
      //
      scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>),
    );
  }),
  share(),
);

// 合并不同来源的数据并进行合并，避免死锁
if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  Terminal.fromNodeEnv().channel.publishChannel('quote', { pattern: `^OKX/` }, (channel_id) => {
    const [datasource_id, product_id] = decodePath(channel_id);
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    return quote$.pipe(filter((x) => x.product_id === product_id));
  });

  quote$
    .pipe(
      writeToSQL({
        terminal: Terminal.fromNodeEnv(),
        writeInterval: 1000,
        tableName: 'quote',
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

export const swapOpenInterest$ = defer(() => swapOpenInterests$).pipe(
  map((x) => new Map(x.data.map((x: any) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
