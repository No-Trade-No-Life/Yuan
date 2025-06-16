import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay, Subject, tap, toArray } from 'rxjs';
import { ex, EXCHANGE_ID } from './api';
import { terminal } from './terminal';

export const mapProductIdToSymbol: Record<string, string> = {};
export const mapSymbolToProductId: Record<string, string> = {};

const product$ = new Subject<IProduct>();

export const products$ = defer(() => ex.loadMarkets()).pipe(
  mergeMap((markets) => Object.values(markets)),
  filter((market): market is Exclude<typeof market, undefined> => !!market),
  tap((market) => {
    console.info('Product-Symbol', market.id, market.symbol);
    mapProductIdToSymbol[market.id] = market.symbol;
    mapSymbolToProductId[market.symbol] = market.id;
  }),
  map(
    (market): IProduct => ({
      datasource_id: EXCHANGE_ID,
      product_id: market.id,
      base_currency: market.base,
      quote_currency: market.quote,
      value_scale: market.contractSize || 1,
      volume_step: market.precision.amount || 1,
      price_step: market.precision.price || 1,
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
  ),
  tap((x) => {
    product$.next(x);
  }),
  toArray(),
  repeat({ delay: 86400_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

products$.subscribe();

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});
