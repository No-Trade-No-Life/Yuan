import { encodePath } from '@yuants/data-model';
import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { defer, filter, from, map, mergeMap, repeat, retry, shareReplay, Subject, tap, toArray } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

const swapInstruments$ = defer(() => client.getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const usdtSwapProducts$ = swapInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      filter((x) => x.ctType === 'linear' && x.settleCcy === 'USDT'),
      map(
        (x): IProduct => ({
          datasource_id: 'OKX',
          product_id: encodePath(x.instType, x.instId),
          name: `${x.ctValCcy}-${x.settleCcy}-PERP`,
          base_currency: x.ctValCcy,
          quote_currency: x.settleCcy,
          value_scale: +x.ctVal,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
          value_scale_unit: '',
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
    ),
  ),
  shareReplay(1),
);

usdtSwapProducts$.subscribe();
const marginInstruments$ = defer(() => client.getInstruments({ instType: 'MARGIN' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);
export const marginProducts$ = marginInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      //
      map(
        (x): IProduct => ({
          datasource_id: 'OKX',
          product_id: encodePath(x.instType, x.instId),
          base_currency: x.baseCcy,
          quote_currency: x.quoteCcy,
          value_scale: 1,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
          name: `${x.baseCcy}-${x.quoteCcy}-MARGIN`,
          value_scale_unit: '',
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
    ),
  ),
  shareReplay(1),
);

marginProducts$.subscribe();

export const mapProductIdToMarginProduct$ = marginProducts$.pipe(
  map((x) => new Map(x.map((x) => [x.product_id, x])), shareReplay(1)),
);

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  writeInterval: 1_000,
  conflictKeys: ['datasource_id', 'product_id'],
});

export const mapProductIdToUsdtSwapProduct$ = usdtSwapProducts$.pipe(
  map((x) => new Map(x.map((x) => [x.product_id, x]))),
  shareReplay(1),
);
