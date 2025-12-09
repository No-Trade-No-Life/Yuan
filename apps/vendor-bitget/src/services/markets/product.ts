import { IProduct } from '@yuants/data-product';
import { encodePath } from '@yuants/utils';
import { IUtaInstrument, getInstruments } from '../../api/public-api';

// product
export const listProducts = async (): Promise<IProduct[]> => {
  // usdt-m swap
  const usdtFuturesProductRes = await getInstruments({ category: 'USDT-FUTURES' });
  if (usdtFuturesProductRes.msg !== 'success') {
    throw new Error(usdtFuturesProductRes.msg);
  }
  // mixed-coin swap, (including coin-m and coin-f)
  const coinFuturesProductRes = await getInstruments({ category: 'COIN-FUTURES' });
  if (coinFuturesProductRes.msg !== 'success') {
    throw new Error(coinFuturesProductRes.msg);
  }
  const spotProductRes = await getInstruments({ category: 'SPOT' });
  if (spotProductRes.msg !== 'success') {
    throw new Error(spotProductRes.msg);
  }
  const usdtFutures = usdtFuturesProductRes.data.map(
    (product: IUtaInstrument): IProduct => ({
      product_id: encodePath('BITGET', `USDT-FUTURES`, product.symbol),
      datasource_id: 'BITGET',
      quote_currency: product.quoteCoin,
      base_currency: product.baseCoin,
      price_step: Number(`1e-${product.pricePrecision}`),
      volume_step: product.quantityMultiplier
        ? +product.quantityMultiplier
        : Number(`1e-${product.quantityPrecision}`),
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: product.maxLeverage ? 1 / Number(product.maxLeverage) : 0,
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
    (product: IUtaInstrument): IProduct => ({
      product_id: encodePath('BITGET', `COIN-FUTURES`, product.symbol),
      datasource_id: 'BITGET',
      quote_currency: product.quoteCoin,
      base_currency: product.baseCoin,
      price_step: Number(`1e-${product.pricePrecision}`),
      volume_step: product.quantityMultiplier
        ? +product.quantityMultiplier
        : Number(`1e-${product.quantityPrecision}`),
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: product.maxLeverage ? 1 / Number(product.maxLeverage) : 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'BITGET/COIN-FUTURES',
      no_interest_rate: false,
    }),
  );

  const spots = spotProductRes.data.map(
    (product: IUtaInstrument): IProduct => ({
      product_id: encodePath('BITGET', 'SPOT', product.symbol),
      datasource_id: 'BITGET',
      quote_currency: product.quoteCoin,
      base_currency: product.baseCoin,
      price_step: Number(`1e-${product.pricePrecision}`),
      volume_step: product.quantityMultiplier
        ? +product.quantityMultiplier
        : Number(`1e-${product.quantityPrecision}`),
      name: '',
      value_scale: 1,
      value_scale_unit: '',
      margin_rate: 0,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: false,
      market_id: 'BITGET/SPOT',
      no_interest_rate: true,
    }),
  );

  return [...usdtFutures, ...coinFutures, ...spots];
};
