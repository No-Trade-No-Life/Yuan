import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, from, map, mergeMap, repeat, retry, shareReplay, Subject, tap, toArray } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

export const mapSymbolToMarket$ = defer(async () => {
  const res = await client.getFuturesMarket();
  if (res.code !== 0) {
    throw new Error(res.message);
  }
  return res.data;
}).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.market, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay(1),
);

const futuresProducts$ = defer(async () => {
  const res = await client.getFuturesMarket();
  if (res.code !== 0) {
    throw new Error(res.message);
  }

  const futures = res.data.map(
    (item): IProduct => ({
      datasource_id: 'COINEX',
      product_id: encodePath('SWAP', item.market),
      quote_currency: item.quote_ccy,
      base_currency: item.base_ccy,
      price_step: Number(item.quote_ccy_precision),
      // FIXME: volume_step, value_scale
      volume_step: 1,
      value_scale: 1,
      name: '',
      value_scale_unit: '',
      margin_rate: 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
    }),
  );
  return futures;
}).pipe(
  tap((list) => {
    list.forEach((v) => product$.next(v));
  }),
  tap({
    error: (e) => {
      console.error(formatTime(Date.now()), 'FuturesProducts', e);
    },
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

createSQLWriter<IProduct>(terminal, {
  tableName: 'product',
  data$: product$,
  writeInterval: 1000,
  keyFn: (x) => encodePath(x.datasource_id, x.product_id),
  conflictKeys: ['datasource_id', 'product_id'],
});

futuresProducts$.subscribe();

const mapProductIdToFuturesProduct$ = futuresProducts$.pipe(
  //
  map((products) => new Map(products.map((v) => [v.product_id, v]))),
  shareReplay(1),
);
