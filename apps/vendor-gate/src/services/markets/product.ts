import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { defer, from, map, mergeMap, repeat, retry, shareReplay, Subject, tap, toArray } from 'rxjs';
import { getFuturesContracts } from '../../api/public-api';
import { encodePath } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

const product$ = new Subject<IProduct>();

const usdtFutureProducts$ = defer(() => getFuturesContracts('usdt', {})).pipe(
  mergeMap((contracts) =>
    from(contracts).pipe(
      map((contract): IProduct => {
        const [base, quote] = contract.name.split('_');
        return {
          datasource_id: 'GATE',
          product_id: encodePath('GATE', 'FUTURE', contract.name),
          base_currency: base,
          quote_currency: quote,
          value_scale: Number(contract.quanto_multiplier),
          price_step: Number(contract.order_price_round),
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
          market_id: 'GATE/USDT-FUTURE',
          no_interest_rate: false,
        };
      }),
      tap((item) => product$.next(item)),
      toArray(),
    ),
  ),
  repeat({ delay: 3_600_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);

usdtFutureProducts$.subscribe();

export const mapProductIdToUsdtFutureProduct$ = usdtFutureProducts$.pipe(
  map((items) => new Map(items.map((item) => [item.product_id, item]))),
  shareReplay(1),
);

createSQLWriter(terminal, {
  data$: product$,
  tableName: 'product',
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});
