import { IProduct } from '@yuants/data-product';
import { encodePath } from '@yuants/utils';
import { getApiV1ExchangeInfo, getFApiV1ExchangeInfo } from '../../api/public-api';

export const listProducts = async (): Promise<IProduct[]> => {
  const [perpExchangeInfo, spotExchangeInfo] = await Promise.all([
    getFApiV1ExchangeInfo({}),
    getApiV1ExchangeInfo({}),
  ]);

  const pickPriceStep = (symbol: {
    filters: { filterType: string; tickSize?: string }[];
    pricePrecision: number;
  }) => {
    const priceFilter = symbol.filters.find((filter) => filter.filterType === 'PRICE_FILTER');
    return priceFilter ? +priceFilter.tickSize! : Number(`1e-${symbol.pricePrecision}`);
  };

  const pickVolumeStep = (symbol: {
    filters: { filterType: string; stepSize?: string }[];
    quantityPrecision: number;
  }) => {
    const lotSizeFilter = symbol.filters.find((filter) => filter.filterType === 'LOT_SIZE');
    return lotSizeFilter ? +lotSizeFilter.stepSize! : Number(`1e-${symbol.quantityPrecision}`);
  };

  const perpProducts: IProduct[] = perpExchangeInfo.symbols
    .filter((symbol) => symbol.status === 'TRADING')
    .map(
      (symbol): IProduct => ({
        datasource_id: 'ASTER',
        product_id: encodePath('ASTER', 'PERP', symbol.symbol),
        name: `${symbol.baseAsset}/${symbol.quoteAsset} PERP`,
        quote_currency: symbol.quoteAsset,
        base_currency: symbol.baseAsset,
        value_scale_unit: '',
        value_based_cost: 0,
        volume_based_cost: 0,
        max_volume: 0,
        price_step: pickPriceStep(symbol),
        volume_step: pickVolumeStep(symbol),
        value_scale: 1,
        allow_long: true,
        allow_short: true,
        margin_rate: 0.1,
        max_position: 0,
        market_id: 'ASTER/PERPETUAL',
        no_interest_rate: false,
      }),
    );

  const spotProducts: IProduct[] = spotExchangeInfo.symbols
    .filter((symbol) => symbol.status === 'TRADING')
    .map(
      (symbol): IProduct => ({
        datasource_id: 'ASTER',
        product_id: encodePath('ASTER', 'SPOT', symbol.symbol),
        name: `${symbol.baseAsset}/${symbol.quoteAsset} SPOT`,
        quote_currency: symbol.quoteAsset,
        base_currency: symbol.baseAsset,
        value_scale_unit: '',
        value_based_cost: 0,
        volume_based_cost: 0,
        max_volume: 0,
        price_step: pickPriceStep(symbol),
        volume_step: pickVolumeStep(symbol),
        value_scale: 1,
        allow_long: true,
        allow_short: false,
        margin_rate: 1,
        max_position: 0,
        market_id: 'ASTER/SPOT',
        no_interest_rate: true,
      }),
    );

  return [...perpProducts, ...spotProducts];
};
