import { encodePath } from '@yuants/data-model';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { defer, from, map, mergeMap, repeat, retry, shareReplay, toArray } from 'rxjs';
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

swapTickers$
  .pipe(
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
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      writeInterval: 1000,
      tableName: 'quote',
      keyFn: (quote) => encodePath(quote.datasource_id, quote.product_id),
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();

spotTickers$
  .pipe(
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
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      writeInterval: 1000,
      tableName: 'quote',
      keyFn: (quote) => encodePath(quote.datasource_id, quote.product_id),
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();

const swapOpenInterests$ = defer(() => client.getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

swapOpenInterests$
  .pipe(
    mergeMap((x) => x.data || []),
    map(
      (x): Partial<IQuote> => ({
        datasource_id: 'OKX',
        product_id: encodePath('SWAP', x.instId),
        open_interest: x.oi,
      }),
    ),
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      writeInterval: 1000,
      tableName: 'quote',
      keyFn: (quote) => encodePath(quote.datasource_id, quote.product_id),
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();

export const swapOpenInterest$ = defer(() => swapOpenInterests$).pipe(
  map((x) => new Map(x.data.map((x) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
