import { IProduct, IQueryProductsRequest, provideQueryProductsService } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getFutureExchangeInfo, getSpotExchangeInfo } from '../api/public-api';

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
  async (req: IQueryProductsRequest): Promise<IProduct[]> => {
    // Directly call the external API to get exchange info
    const [futureExchangeInfo, spotExchangeInfo] = await Promise.all([
      getFutureExchangeInfo(),
      getSpotExchangeInfo(),
    ]);

    const products: IProduct[] = [];

    // Convert future symbols to IProduct format
    for (const symbol of futureExchangeInfo.symbols) {
      products.push({
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
      });
    }

    // Convert spot symbols to IProduct format
    for (const symbol of spotExchangeInfo.symbols) {
      if (symbol.isSpotTradingAllowed) {
        products.push({
          datasource_id: 'BINANCE',
          product_id: encodePath('BINANCE', 'SPOT', symbol.symbol),
          base_currency: symbol.baseAsset,
          quote_currency: symbol.quoteAsset,
          price_step: +`1e-${symbol.quotePrecision}`,
          value_scale: 1,
          volume_step: +`1e-${symbol.baseAssetPrecision}`,
          name: `${symbol.baseAsset}/${symbol.quoteAsset} SPOT`,
          value_scale_unit: '',
          margin_rate: 1,
          value_based_cost: 0,
          volume_based_cost: 0,
          max_position: 0,
          max_volume: 0,
          allow_long: true,
          allow_short: false,
          market_id: 'BINANCE/SPOT',
          no_interest_rate: true,
        });
      }

      if (symbol.isMarginTradingAllowed) {
        products.push({
          datasource_id: 'BINANCE',
          product_id: encodePath('BINANCE', 'MARGIN', symbol.symbol),
          base_currency: symbol.baseAsset,
          quote_currency: symbol.quoteAsset,
          price_step: +`1e-${symbol.quotePrecision}`,
          value_scale: 1,
          volume_step: +`1e-${symbol.baseAssetPrecision}`,
          name: `${symbol.baseAsset}/${symbol.quoteAsset} MARGIN`,
          value_scale_unit: '',
          margin_rate: 1,
          value_based_cost: 0,
          volume_based_cost: 0,
          max_position: 0,
          max_volume: 0,
          allow_long: true,
          allow_short: true,
          market_id: 'BINANCE/MARGIN',
          no_interest_rate: false,
        });
      }
    }

    return products;
  },
  {
    auto_refresh_interval: 3600_000,
  },
);
