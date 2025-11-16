import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getFApiV1ExchangeInfo } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

// Provide QueryProducts service for ASTER
export const productService = provideQueryProductsService(
  terminal,
  'ASTER',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
    // Fetch exchange info from ASTER API
    const exchangeInfo = await getFApiV1ExchangeInfo({});

    // Convert symbols to IProduct format
    return exchangeInfo.symbols
      .filter((symbol) => symbol.status === 'TRADING') // Only include active trading symbols
      .map((symbol): IProduct => {
        // Find price filter for price step
        const priceFilter = symbol.filters.find((filter) => filter.filterType === 'PRICE_FILTER');
        const priceStep = priceFilter ? +priceFilter.tickSize : 1e-2;

        // Find lot size filter for volume step
        const lotSizeFilter = symbol.filters.find((filter) => filter.filterType === 'LOT_SIZE');
        const volumeStep = lotSizeFilter ? +lotSizeFilter.stepSize : Number(`1e-${symbol.quantityPrecision}`);

        return {
          datasource_id: 'ASTER',
          product_id: encodePath('PERPETUAL', symbol.symbol),
          name: `${symbol.baseAsset}/${symbol.quoteAsset} PERP`,
          quote_currency: symbol.quoteAsset,
          base_currency: symbol.baseAsset,
          value_scale_unit: '',
          value_based_cost: 0,
          volume_based_cost: 0,
          max_volume: 0,
          price_step: priceStep,
          volume_step: volumeStep,
          value_scale: 1,
          allow_long: true,
          allow_short: true,
          margin_rate: 0.1, // Default margin rate, can be adjusted based on actual requirements
          max_position: 0,
          market_id: 'ASTER/PERPETUAL',
          no_interest_rate: false,
        };
      });
  },
  {
    auto_refresh_interval: 3600_000, // Refresh hourly
  },
);
