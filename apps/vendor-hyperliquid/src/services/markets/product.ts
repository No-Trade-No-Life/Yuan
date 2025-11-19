import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { Subject, defer, repeat, retry, shareReplay, tap } from 'rxjs';
import { getPerpetualsMetaData, getSpotMetaData } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();
const product$ = new Subject<IProduct>();
let latestProducts: IProduct[] = [];

const fetchProducts = async (): Promise<IProduct[]> => {
  const [spotMetaData, perpetualsMetaData] = await Promise.all([getSpotMetaData(), getPerpetualsMetaData()]);
  const spotProducts = spotMetaData.tokens.map(
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
      market_id: 'HYPERLIQUID/SPOT',
      no_interest_rate: true,
    }),
  );
  const perpetualProducts = perpetualsMetaData.universe.map(
    (product, index): IProduct => ({
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
      market_id: 'HYPERLIQUID/PERPETUAL',
      no_interest_rate: false,
    }),
  );
  return [...spotProducts, ...perpetualProducts];
};

const refresh$ = defer(fetchProducts).pipe(
  tap((products) => {
    latestProducts = products;
    products.forEach((product) => product$.next(product));
  }),
  tap({
    error: (err) => console.error(formatTime(Date.now()), 'ProductRefreshFailed', err),
  }),
  retry({ delay: 5000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

refresh$.subscribe();

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  writeInterval: 1000,
  conflictKeys: ['datasource_id', 'product_id'],
});

provideQueryProductsService(
  terminal,
  'HYPERLIQUID',
  async (_req: IQueryProductsRequest) => {
    if (!latestProducts.length) {
      latestProducts = await fetchProducts();
    }
    return latestProducts;
  },
  { auto_refresh_interval: 86400_000 },
);
