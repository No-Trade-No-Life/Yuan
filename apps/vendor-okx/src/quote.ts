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
  Observable,
  repeat,
  retry,
  scan,
  shareReplay,
  toArray,
} from 'rxjs';
import { client } from './api';
import { OKXWsClient } from './websocket';

const wsClient = new OKXWsClient('ws/v5/public');

const swapInstruments$ = defer(() => client.getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);
const spotInstruments$ = defer(() => client.getInstruments({ instType: 'SPOT' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);

const spotTickers$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
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

const swapTicker$ = swapInstruments$.pipe(
  mergeMap((x) => {
    return new Observable<any>((subscriber) => {
      for (const inst of x) {
        wsClient.subscribe('tickers', inst.instId, (data: any) => {
          subscriber.next(data);
        });
      }
    });
  }),
);
const spotTicker$ = spotInstruments$.pipe(
  mergeMap((x) => {
    return new Observable<any>((subscriber) => {
      for (const inst of x) {
        wsClient.subscribe('tickers', inst.instId, (data: any) => {
          subscriber.next(data);
        });
      }
    });
  }),
);

const quote1$ = swapTicker$.pipe(
  map((ticker) => ({
    datasource_id: 'OKX',
    product_id: encodePath('SWAP', ticker.instId),
    last_price: ticker.last,
    ask_price: ticker.askPx,
    bid_price: ticker.bidPx,
    ask_volume: ticker.askSz,
    bid_volume: ticker.bidSz,
  })),
);
const quote2$ = spotTicker$.pipe(
  map((ticker) => ({
    datasource_id: 'OKX',
    product_id: encodePath('SPOT', ticker.instId),
    last_price: ticker.last,
    ask_price: ticker.askPx,
    bid_price: ticker.bidPx,
    ask_volume: ticker.askSz,
    bid_volume: ticker.bidSz,
  })),
);

const quote3$ = spotTicker$.pipe(
  map((ticker) => ({
    datasource_id: 'OKX',
    product_id: encodePath('MARGIN', ticker.instId),
    last_price: ticker.last,
    ask_price: ticker.askPx,
    bid_price: ticker.bidPx,
    ask_volume: ticker.askSz,
    bid_volume: ticker.bidSz,
  })),
);

const swapOpenInterestInner$ = swapInstruments$.pipe(
  mergeMap(
    (x) =>
      new Observable<any>((subscriber) => {
        for (const inst of x) {
          wsClient.subscribe('open-interest', inst.instId, (data: any) => {
            console.info(data);
            const quote: Partial<IQuote> = {
              datasource_id: 'OKX',
              product_id: encodePath('SWAP', data.instId),
              open_interest: data.oi,
            };
            subscriber.next(quote);
          });
        }
      }),
  ),
);

const swapOpenInterests$ = defer(() => client.getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const quote4$ = swapOpenInterestInner$.pipe(
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', x.instId),
      open_interest: x.oi,
    }),
  ),
);

const quote$ = merge(quote1$, quote2$, quote3$, quote4$).pipe(
  groupBy((x) => encodePath(x.datasource_id, x.product_id)),
  mergeMap((group$) => {
    return group$.pipe(scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>));
  }),
);

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

// 合并不同来源的数据并进行合并，避免死锁
if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  merge(quote1$, quote2$, quote3$, quote4$)
    .pipe(
      groupBy((x) => encodePath(x.datasource_id, x.product_id)),
      mergeMap((group$) => {
        return group$.pipe(scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>));
      }),
      writeToSQL({
        terminal: Terminal.fromNodeEnv(),
        writeInterval: 1000,
        tableName: 'quote',
        keyFn: (quote) => encodePath(quote.datasource_id, quote.product_id),
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

export const swapOpenInterest$ = defer(() => swapOpenInterests$).pipe(
  map((x) => new Map(x.data.map((x: any) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
