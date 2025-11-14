import { requestPublic, requestPublicWithFlowControl } from './client';

export const getFuturesContracts = (
  settle: string,
  params?: { limit?: number; offset?: number },
): Promise<any> => requestPublic('GET', `/api/v4/futures/${settle}/contracts`, params);

export const getFuturesTickers = (settle: string, params?: { contract?: string }): Promise<any> =>
  requestPublic('GET', `/api/v4/futures/${settle}/tickers`, params);

export const getFutureFundingRate = (
  settle: string,
  params: { contract: string; limit?: number },
): Promise<any> => requestPublic('GET', `/api/v4/futures/${settle}/funding_rate`, params);

export const getSpotTickers = (params?: { currency_pair?: string; timezone?: string }): Promise<any> =>
  requestPublic('GET', `/api/v4/spot/tickers`, params);

export const getFuturesOrderBook = (
  settle: string,
  params: { contract: string; interval?: string; limit?: number; with_id?: boolean },
): Promise<any> =>
  requestPublicWithFlowControl('GET', `/api/v4/futures/${settle}/order_book`, { period: 10_000, limit: 200 }, params);
