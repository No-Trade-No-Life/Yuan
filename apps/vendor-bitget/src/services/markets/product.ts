import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { Subject, defer, repeat, retry, shareReplay, tap } from 'rxjs';
import { IMixMarketContract, getMarketContracts } from '../../api/public-api';

const product$ = new Subject<IProduct>();

// product
export const listProducts = async (): Promise<IProduct[]> => {
  // usdt-m swap
  const usdtFuturesProductRes = await getMarketContracts({ productType: 'USDT-FUTURES' });
  if (usdtFuturesProductRes.msg !== 'success') {
    throw new Error(usdtFuturesProductRes.msg);
  }
  // mixed-coin swap, (including coin-m and coin-f)
  const coinFuturesProductRes = await getMarketContracts({ productType: 'COIN-FUTURES' });
  if (coinFuturesProductRes.msg !== 'success') {
    throw new Error(coinFuturesProductRes.msg);
  }
  const usdtFutures = usdtFuturesProductRes.data.map(
    (product: IMixMarketContract): IProduct => ({
      product_id: encodePath('BITGET', `USDT-FUTURES`, product.symbol),
      datasource_id: 'BITGET',
      quote_currency: product.quoteCoin,
      base_currency: product.baseCoin,
      price_step: Number(`1e-${product.pricePlace}`),
      volume_step: +product.sizeMultiplier,
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'BITGET/USDT-FUTURES',
      no_interest_rate: false,
    }),
  );
  const coinFutures = coinFuturesProductRes.data.map(
    (product: IMixMarketContract): IProduct => ({
      product_id: encodePath('BITGET', `COIN-FUTURES`, product.symbol),
      datasource_id: 'BITGET',
      quote_currency: product.quoteCoin,
      base_currency: product.baseCoin,
      price_step: Number(`1e-${product.pricePlace}`),
      volume_step: +product.sizeMultiplier,
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'BITGET/USDT-FUTURES',
      no_interest_rate: false,
    }),
  );

  return [...usdtFutures, ...coinFutures];
};

const futureProducts$ = defer(listProducts).pipe(
  tap((list) => {
    list.forEach((product) => product$.next(product));
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

createSQLWriter<IProduct>(Terminal.fromNodeEnv(), {
  data$: product$,
  tableName: 'product',
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});

futureProducts$.subscribe();
