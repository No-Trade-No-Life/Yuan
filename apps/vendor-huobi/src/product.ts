import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { getPerpetualContractSymbols, getSwapCrossLadderMargin, getSpotSymbols } from './api/public-api';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service for swap products
export const swapProductService = provideQueryProductsService(
  terminal,
  'HUOBI-SWAP',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
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
      });
    }

    return products;
  },
  {
    auto_refresh_interval: 3600_000,
  },
);

// Provide QueryProducts service for spot products
export const spotProductService = provideQueryProductsService(
  terminal,
  'HUOBI-SPOT',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
    const products: IProduct[] = [];

    // Get spot products
    const spotSymbols = await getSpotSymbols();

    for (const symbol of spotSymbols?.data || []) {
      if (symbol.state !== 'online') continue; // Only include online symbols

      products.push({
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
      });
    }

    return products;
  },
  {
    auto_refresh_interval: 3600_000,
  },
);
