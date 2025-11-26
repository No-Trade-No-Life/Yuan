import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getFutureExchangeInfo } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

export const listProducts = async () => {
  // Directly call the external API to get exchange info
  const exchangeInfo = await getFutureExchangeInfo();

  // Convert symbols to IProduct format
  return exchangeInfo.symbols.map((symbol): IProduct => {
    return {
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', symbol.symbol),
      base_currency: symbol.baseAsset,
      quote_currency: symbol.quoteAsset,
      price_step: +`1e-${symbol.pricePrecision}`,
      value_scale: 1,
      volume_step: +`1e-${symbol.quantityPrecision}`,
      name: `${symbol.baseAsset}/${symbol.quoteAsset} PERP`,
      value_scale_unit: '',
      margin_rate: +symbol.requiredMarginPercent / 100,
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
      allow_long: true,
      allow_short: true,
      market_id: 'BINANCE/USDT-FUTURE',
      no_interest_rate: false,
    };
  });
};

// Provide QueryProducts service with the new design
const cache = provideQueryProductsService(
  terminal,
  'BINANCE',
  async (req: IQueryProductsRequest): Promise<IProduct[]> => listProducts(),
  {
    auto_refresh_interval: 3600_000,
  },
);
