import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, repeat, retry, shareReplay, Subject, tap } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

const tokenProduct$ = defer(async () => {
  const res = await client.getSpotMetaData();
  return res.tokens.map(
    (token): IProduct => ({
      product_id: encodePath('SPOT', `${token.name}-USDC`),
      datasource_id: 'HYPERLIQUID',
      quote_currency: 'USDC',
      base_currency: token.name,
      price_step: 1e-2,
      volume_step: Number(`1e-${token.szDecimals}`),
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: 1,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: false,
      market_id: 'Hyperliquid',
    }),
  );
}).pipe(
  tap((list) => list.forEach((product) => product$.next(product))),
  tap({
    error: (e) => {
      console.error(formatTime(Date.now()), 'SpotProducts', e);
    },
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

export const perpetualProduct$ = defer(async () => {
  const res = await client.getPerpetualsMetaData();
  return res.universe.map(
    (product): IProduct => ({
      product_id: encodePath('PERPETUAL', `${product.name}-USD`),
      datasource_id: 'HYPERLIQUID',
      quote_currency: 'USD',
      base_currency: product.name,
      price_step: 1e-2,
      volume_step: Number(`1e-${product.szDecimals}`),
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: 1 / product.maxLeverage,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'Hyperliquid',
    }),
  );
}).pipe(
  tap((list) => list.forEach((product) => product$.next(product))),
  tap({
    error: (e) => {
      console.error(formatTime(Date.now()), 'PerpetualProducts', e);
    },
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

perpetualProduct$.subscribe();
tokenProduct$.subscribe();

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  keyFn: (x) => encodePath(x.datasource_id, x.product_id),
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});
