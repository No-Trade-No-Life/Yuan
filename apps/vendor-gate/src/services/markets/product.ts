import { createProductCache } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getFuturesContracts, getSpotCurrencyPairs } from '../../api/public-api';

export const productCache = createProductCache(Terminal.fromNodeEnv());

export const listProducts = async () => {
  const [futureProducts, spotProducts] = await Promise.all([
    getFuturesContracts('usdt', {}),
    getSpotCurrencyPairs(),
  ]);
  const fps = futureProducts.map((contract) => {
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
      margin_rate: 1 / Number(contract.leverage_max),
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'GATE/USDT-FUTURE',
      no_interest_rate: false,
    };
  });
  const sps = spotProducts.map((spot) => ({
    datasource_id: 'GATE',
    product_id: encodePath('GATE', 'SPOT', spot.id),
    base_currency: spot.base,
    quote_currency: spot.quote,
    value_scale: 1,
    price_step: Number(`1e-${spot.precision}`),
    volume_step: 1,
    name: '',
    value_scale_unit: '',
    margin_rate: 0,
    value_based_cost: 0,
    volume_based_cost: 0,
    max_position: 0,
    max_volume: 0,
    allow_long: true,
    allow_short: false,
    market_id: 'GATE/USDT-SPOT',
    no_interest_rate: false,
  }));

  return [...fps, ...sps];
};
