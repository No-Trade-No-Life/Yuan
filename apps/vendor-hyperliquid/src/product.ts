import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service for Hyperliquid
export const productService = provideQueryProductsService(
  terminal,
  'HYPERLIQUID',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
    // Fetch both spot and perpetual products
    const [spotMetaData, perpetualsMetaData] = await Promise.all([
      client.getSpotMetaData(),
      client.getPerpetualsMetaData(),
    ]);

    // Convert spot tokens to IProduct format
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

    // Convert perpetual products to IProduct format
    const perpetualProducts = perpetualsMetaData.universe.map(
      (product): IProduct => ({
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

    // Combine all products
    return [...spotProducts, ...perpetualProducts];
  },
  {
    auto_refresh_interval: 86400_000, // Refresh daily (24 hours)
  },
);
