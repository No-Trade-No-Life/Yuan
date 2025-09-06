import { createCache } from '@yuants/cache';
import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { encodePath } from '@yuants/utils';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay, Subject, toArray } from 'rxjs';
import { client } from './api';

const product$ = new Subject<IProduct>();

const cacheOfCrossLeverage = createCache(() => client.getSwapCrossLadderMargin(), {
  expire: 3600_000, // 1 hour
});

const productIdToMaxLeverage = createCache(
  async (product_id, force_update) => {
    const res = await cacheOfCrossLeverage.query('', force_update);
    return res?.data
      .find((x) => x.contract_code === product_id)
      ?.list.reduce((acc, cur) => Math.max(acc, cur.lever_rate), 1);
  },
  {
    expire: 3600_000, // 1 hour
  },
);

const swapSymbols = createCache(() => client.getPerpetualContractSymbols(), {
  expire: 3600_000,
});

const swapProducts = createCache(
  async (_, force_update) => {
    const products: IProduct[] = [];
    const symbols = await swapSymbols.query('', force_update);
    for (const symbol of symbols?.data || []) {
      if (symbol.contract_status !== 1) continue; // Only include active contracts
      const maxLeverage = await productIdToMaxLeverage.query(symbol.contract_code);
      const product: IProduct = {
        datasource_id: 'HUOBI-SWAP',
        product_id: symbol.contract_code,
        base_currency: symbol.symbol,
        quote_currency: 'USDT',
        value_scale: symbol.contract_size,
        price_step: symbol.price_tick,
        volume_step: 1,
        name: '',
        value_scale_unit: '',
        margin_rate: 1 / (maxLeverage || 1),
        value_based_cost: 0,
        volume_based_cost: 0,
        max_position: 0,
        max_volume: 0,
        allow_long: true,
        allow_short: true,
        market_id: 'HUOBI/SWAP',
        no_interest_rate: false,
      };
      products.push(product);
      product$.next(product);
    }
    return products;
  },
  {
    expire: 3600_000, // 1 hour
  },
);

export const perpetualContractProducts$ = defer(() => swapProducts.query('')).pipe(
  map((res) => res || []),
  repeat({ delay: 86400_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

export const spotProducts$ = defer(() => client.getSpotSymbols()).pipe(
  mergeMap((res) => res.data),
  filter((symbol) => symbol.state === 'online'),
  map(
    (symbol): IProduct => ({
      datasource_id: 'HUOBI-SPOT',
      product_id: symbol.sc,
      base_currency: symbol.bc,
      quote_currency: symbol.qc,
      value_scale: 1,
      price_step: 1 / 10 ** symbol.tpp,
      volume_step: 1 / 10 ** symbol.tap,
      name: '',
      value_scale_unit: '',
      margin_rate: 1,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: false,
      market_id: 'HUOBI/SPOT',
      no_interest_rate: true,
    }),
  ),
  toArray(),
  repeat({ delay: 86400_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

spotProducts$.subscribe();
perpetualContractProducts$.subscribe();

createSQLWriter<IProduct>(Terminal.fromNodeEnv(), {
  tableName: 'product',
  writeInterval: 1000,
  conflictKeys: ['datasource_id', 'product_id'],
  data$: product$,
});
