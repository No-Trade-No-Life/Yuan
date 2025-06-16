import { encodePath, formatTime } from '@yuants/data-model';
import { IProduct } from '@yuants/data-product';
import { createSQLWriter } from '@yuants/sql';
import { Subject, defer, repeat, retry, shareReplay, tap } from 'rxjs';
import { client } from './api';
import { terminal } from './terminal';

const product$ = new Subject<IProduct>();

// product
const futureProducts$ = defer(async () => {
  // usdt-m swap
  const usdtFuturesProductRes = await client.getMarketContracts({ productType: 'USDT-FUTURES' });
  if (usdtFuturesProductRes.msg !== 'success') {
    throw new Error(usdtFuturesProductRes.msg);
  }
  // mixed-coin swap, (including coin-m and coin-f)
  const coinFuturesProductRes = await client.getMarketContracts({ productType: 'COIN-FUTURES' });
  if (coinFuturesProductRes.msg !== 'success') {
    throw new Error(coinFuturesProductRes.msg);
  }
  const usdtFutures = usdtFuturesProductRes.data.map(
    (product): IProduct => ({
      product_id: encodePath(`USDT-FUTURES`, product.symbol),
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
    }),
  );
  const coinFutures = coinFuturesProductRes.data.map(
    (product): IProduct => ({
      product_id: encodePath(`COIN-FUTURES`, product.symbol),
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
    }),
  );

  return [...usdtFutures, ...coinFutures];
}).pipe(
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

createSQLWriter<IProduct>(terminal, {
  data$: product$,
  tableName: 'product',
  conflictKeys: ['datasource_id', 'product_id'],
  writeInterval: 1000,
});

futureProducts$.subscribe();
