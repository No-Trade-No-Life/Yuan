import { IInterestRate } from '@yuants/data-interest-rate';
import {
  decodePath,
  encodePath,
  formatTime,
  getDataRecordWrapper,
  IProduct,
  ITick,
  UUID,
} from '@yuants/data-model';
import { createSeriesProvider } from '@yuants/data-series';
import { provideTicks, Terminal, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  combineLatest,
  defer,
  delayWhen,
  firstValueFrom,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { CoinExClient } from './api';

const DATASOURCE_ID = 'CoinEx';

const client = new CoinExClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        access_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
      },
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const terminal = new Terminal(process.env.HOST_URL!, {
  name: 'CoinEx',
  terminal_id: process.env.TERMINAL_ID || `coinex/${UUID()}`,
});

const mapSymbolToMarket$ = defer(async () => {
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
      datasource_id: DATASOURCE_ID,
      product_id: encodePath('SWAP', item.market),
      quote_currency: item.quote_ccy,
      base_currency: item.base_ccy,
      price_step: Number(item.quote_ccy_precision),
      // FIXME: volume_step, value_scale
      volume_step: 1,
      value_scale: 1,
    }),
  );
  return futures;
}).pipe(
  tap({
    error: (e) => {
      console.error(formatTime(Date.now()), 'FuturesProducts', e);
    },
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

futuresProducts$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe((products) => {
    console.info(formatTime(Date.now()), 'FUTUREProductsUpdated', products.length);
  });

const mapProductIdToFuturesProduct$ = futuresProducts$.pipe(
  //
  map((products) => new Map(products.map((v) => [v.product_id, v]))),
  shareReplay(1),
);

const mapSymbolToFundingRate$ = defer(() => client.getFuturesFundingRate()).pipe(
  //
  map((v) => v.data),
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

const mapSymbolToTicker$ = defer(() => client.getFuturesTicker()).pipe(
  //
  map((v) => v.data),
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

provideTicks(terminal, DATASOURCE_ID, (product_id) => {
  const [instType, instId] = decodePath(product_id);
  if (instType !== 'SWAP') return [];
  return combineLatest([mapSymbolToTicker$, mapSymbolToMarket$, mapSymbolToFundingRate$]).pipe(
    //
    map(([mapSymbolToTicker, mapSymbolToMarket, mapSymbolToFundingRate]): ITick => {
      const ticker = mapSymbolToTicker.get(instId);
      const market = mapSymbolToMarket.get(instId);
      const fundingRate = mapSymbolToFundingRate.get(instId);
      if (!ticker) {
        throw new Error(`ticker ${instId} not found`);
      }
      if (!market) {
        throw new Error(`market ${instId} not found`);
      }
      if (!fundingRate) {
        throw new Error(`fundingRate ${instId} not found`);
      }
      return {
        product_id,
        datasource_id: DATASOURCE_ID,
        updated_at: Date.now(),
        price: +ticker.last,
        interest_rate_for_long: -+fundingRate.latest_funding_rate,
        interest_rate_for_short: +fundingRate.latest_funding_rate,
        settlement_scheduled_at: +fundingRate.next_funding_time,
        open_interest: +market.open_interest_volume,
      };
    }),
  );
});

createSeriesProvider<IInterestRate>(terminal, {
  tableName: 'interest_rate',
  series_id_prefix_parts: ['coinex'],
  reversed: true,
  serviceOptions: { concurrent: 1 },
  queryFn: async function* ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id] = decodePath(series_id);
    const [instType, instId] = decodePath(product_id);
    let current_page = 0;

    while (true) {
      const res = await client.getFuturesFundingRateHistory({
        market: instId,
        start_time: started_at,
        end_time: ended_at,
        page: current_page,
        limit: 100,
      });
      if (res.code !== 0) {
        throw `API failed: ${res.code} ${res.message}`;
      }
      if (res.data.length === 0) break;

      yield res.data.map(
        (v): IInterestRate => ({
          series_id,
          datasource_id,
          product_id,
          created_at: formatTime(+v.funding_time),
          long_rate: `-${v.actual_funding_rate}`,
          short_rate: `${v.actual_funding_rate}`,
          settlement_price: '',
        }),
      );
      if (!res.pagination.has_next) break;
      if (+res.data[res.data.length - 1].funding_time <= started_at) break;
      current_page++;
      await firstValueFrom(timer(1000));
    }
  },
});
