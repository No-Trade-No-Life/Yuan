import { requestPerpetualPublic, requestSpotPublic } from './client';

export const getFApiV1TickerPrice = () =>
  requestPerpetualPublic<
    {
      symbol: string;
      price: string;
      time?: number;
    }[]
  >('GET', '/fapi/v1/ticker/price');

export const getFApiV1OpenInterest = (params: { symbol: string }) =>
  requestPerpetualPublic<
    {
      symbol: string;
      openInterest: string;
      time: number;
    }
  >('GET', '/fapi/v1/openInterest', params);

export const getFApiV1FundingRate = (params: {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}) =>
  requestPerpetualPublic<
    {
      symbol: string;
      fundingRate: string;
      fundingTime: number;
    }[]
  >('GET', '/fapi/v1/fundingRate', params);

export const getFApiV1ExchangeInfo = () =>
  requestPerpetualPublic<
    {
      symbols: {
        symbol: string;
        status: 'TRADING' | 'BREAK' | 'HALT';
        baseAsset: string;
        quoteAsset: string;
        pricePrecision: number;
        quantityPrecision: number;
        baseAssetPrecision: number;
        quotePrecision: number;
        filters: { filterType: string; [key: string]: any }[];
      }[];
    }
  >('GET', '/fapi/v1/exchangeInfo');

export const getApiV1TickerPrice = () =>
  requestSpotPublic<
    {
      symbol: string;
      price: string;
      time: number;
    }[]
  >('GET', '/api/v1/ticker/price');
