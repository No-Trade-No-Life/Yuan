import { encodePath } from '@yuants/data-model';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { defer, from, groupBy, map, merge, mergeMap, repeat, retry, scan, shareReplay, toArray } from 'rxjs';
import { client } from './api';

const swapTickers$ = defer(() => client.getMarketTickers({ instType: 'SWAP' })).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const spotTickers$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const swapMarketTickers$ = defer(() => swapTickers$).pipe(
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

const quote1$ = swapTickers$.pipe(
  mergeMap((x) => x.data || []),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', ticker.instId),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    }),
  ),
);

const quote2$ = spotTickers$.pipe(
  mergeMap((x) => x.data || []),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SPOT', ticker.instId),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    }),
  ),
);

const swapOpenInterests$ = defer(() => client.getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const quote3$ = swapOpenInterests$.pipe(
  mergeMap((x) => x.data || []),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', x.instId),
      open_interest: x.oi,
    }),
  ),
);

// 合并不同来源的数据并进行合并，避免死锁
if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  merge(quote1$, quote2$, quote3$)
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
  map((x) => new Map(x.data.map((x) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
