import { createClientProductCache, IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getPerpetualContractSymbols, getSpotSymbols, getSwapCrossLadderMargin } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service for swap products
const listSwapProducts = async (): Promise<IProduct[]> => {
  const products: IProduct[] = [];

  // Get perpetual contract products and cross leverage data in parallel
  const [swapSymbols, crossLeverage] = await Promise.all([
    getPerpetualContractSymbols(),
    getSwapCrossLadderMargin(),
  ]);

  for (const symbol of swapSymbols?.data || []) {
    if (symbol.contract_status !== 1) continue; // Only include active contracts

    const maxLeverage = crossLeverage?.data
      .find((x) => x.contract_code === symbol.contract_code)
      ?.list.reduce((acc, cur) => Math.max(acc, cur.lever_rate), 1);

    products.push({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SWAP', symbol.contract_code),
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
      market_id: 'HTX',
      no_interest_rate: false,
    });
  }

  return products;
};

// Provide QueryProducts service for spot products
const listSpotProducts = async (): Promise<IProduct[]> => {
  const products: IProduct[] = [];

  // Get spot products
  const spotSymbols = await getSpotSymbols();

  for (const symbol of spotSymbols?.data || []) {
    if (symbol.state !== 'online') continue; // Only include online symbols

    products.push({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SPOT', symbol.sc),
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
    });
  }

  return products;
};

export const listProducts = async (): Promise<IProduct[]> => {
  const [swapProducts, spotProducts] = await Promise.all([listSwapProducts(), listSpotProducts()]);
  return [...swapProducts, ...spotProducts];
};

export const productCache = createClientProductCache(terminal);
