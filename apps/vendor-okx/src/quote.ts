import { encodePath, formatTime } from '@yuants/data-model';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { defer, from, map, mergeMap, repeat, retry, shareReplay, Subject, toArray } from 'rxjs';
import { client } from './api';

const quote$ = new Subject<IQuote>();

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

createSQLWriter(Terminal.fromNodeEnv(), {
  data$: quote$,
  writeInterval: 1000,
  tableName: 'quote',
  keyFn: (quote) => encodePath(quote.datasource_id, quote.product_id),
  conflictKeys: ['datasource_id', 'product_id'],
});

swapMarketTickers$.subscribe((x) => {
  for (const [instId, ticker] of Object.entries(x)) {
    const product_id = encodePath('SWAP', instId);
    const datasource_id = 'OKX';
    const quote: IQuote = {
      datasource_id,
      product_id,
      updated_at: formatTime(Date.now()),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    };

    quote$.next(quote);
  }
});

spotMarketTickers$.subscribe((x) => {
  for (const [instId, ticker] of Object.entries(x)) {
    const product_id = encodePath('SPOT', instId);
    const datasource_id = 'OKX';
    const quote: IQuote = {
      datasource_id,
      product_id,
      updated_at: formatTime(Date.now()),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    };

    quote$.next(quote);
  }
});
