import { encodePath } from '@yuants/utils';
import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { Subject, defer, from, map, mergeMap, repeat, retry, shareReplay, tap, toArray } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

const futureExchangeInfo$ = defer(() => client.getFutureExchangeInfo()).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);

const futureProducts$ = futureExchangeInfo$.pipe(
  mergeMap((x) =>
    from(x.symbols).pipe(
      //
      map((symbol): IProduct => {
        return {
          datasource_id: 'BINANCE',
          product_id: encodePath('usdt-future', symbol.symbol),
          base_currency: symbol.baseAsset,
          quote_currency: symbol.quoteAsset,
          price_step: +`1e-${symbol.pricePrecision}`,
          value_scale: 1,
          volume_step: +`1e-${symbol.quantityPrecision}`,
          name: `${symbol.baseAsset}/${symbol.quoteAsset} PERP`,
          value_scale_unit: '',
          margin_rate: +symbol.requiredMarginPercent,
          value_based_cost: 0,
          volume_based_cost: 0,
          max_position: 0,
          max_volume: 0,
          allow_long: true,
          allow_short: true,
        };
      }),
      tap((v) => product$.next(v)),
      toArray(),
    ),
  ),
  shareReplay(1),
);

futureProducts$.subscribe();

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  keyFn: (x) => encodePath(x.datasource_id, x.product_id),
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});
