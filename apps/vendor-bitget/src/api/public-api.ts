import { requestPublic, requestPublicWithFlowControl } from './client';

export const getMarketContracts = (params: { symbol?: string; productType: string }): Promise<any> =>
  requestPublic('GET', '/api/v2/mix/market/contracts', params);

export const getSymbols = (params?: { symbol?: string }): Promise<any> =>
  requestPublic('GET', '/api/v2/mix/market/symbols', params);

export const getMarginCurrencies = (): Promise<any> => requestPublic('GET', '/api/v2/margin/currencies');

export const getFutureMarketTicker = (params: { symbol: string; productType: string }): Promise<any> =>
  requestPublic('GET', '/api/v2/mix/market/ticker', params);

export const getFutureMarketTickers = (params: { productType: string }): Promise<any> =>
  requestPublic('GET', '/api/v2/mix/market/tickers', params);

export const getOpenInterest = (params: { symbol: string; productType: string }): Promise<any> =>
  requestPublic('GET', '/api/v2/mix/market/open-interest', params);

export const getNextFundingTime = (params: { symbol: string; productType: string }): Promise<any> =>
  requestPublicWithFlowControl('GET', '/api/v2/mix/market/funding-time', { period: 1000, limit: 20 }, params);

export const getHistoricalFundingRate = (params: {
  symbol: string;
  productType: string;
  pageSize?: string;
  pageNo?: string;
}): Promise<any> =>
  requestPublicWithFlowControl(
    'GET',
    '/api/v2/mix/market/history-fund-rate',
    { period: 1000, limit: 20 },
    params,
  );
