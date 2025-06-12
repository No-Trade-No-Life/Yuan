import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay, Subject, tap, toArray } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

export const perpetualContractProducts$ = defer(() => client.getPerpetualContractSymbols()).pipe(
  mergeMap((res) => res.data),
  filter((symbol) => symbol.contract_status === 1),
  map(
    (symbol): IProduct => ({
      datasource_id: 'huobi-swap',
      product_id: symbol.contract_code,
      base_currency: symbol.symbol,
      quote_currency: 'USDT',
      value_scale: symbol.contract_size,
      price_step: symbol.price_tick,
      volume_step: 1,
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
  tap((x) => product$.next(x)),
  toArray(),
  repeat({ delay: 86400_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const spotProducts$ = defer(() => client.getSpotSymbols()).pipe(
  mergeMap((res) => res.data),
  filter((symbol) => symbol.state === 'online'),
  map(
    (symbol): IProduct => ({
      datasource_id: 'huobi-spot',
      product_id: symbol.sc,
      base_currency: symbol.bc,
      quote_currency: symbol.qc,
      value_scale: 1,
      price_step: 1 / 10 ** symbol.tpp,
      volume_step: 1 / 10 ** symbol.tap,
      name: '',
      value_scale_unit: '',
      margin_rate: 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: false,
    }),
  ),
  toArray(),
  repeat({ delay: 86400_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

spotProducts$.subscribe();
perpetualContractProducts$.subscribe();

createSQLWriter<IProduct>(terminal, {
  tableName: 'product',
  writeInterval: 1000,
  conflictKeys: ['datasource_id', 'product_id'],
  data$: product$,
});
