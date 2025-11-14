import { requestPublic } from './client';

export const getFutureExchangeInfo = () =>
  requestPublic<{ timezone: string; serverTime: number; futuresType: string; rateLimits: any[]; exchangeFilters: any[]; assets: any[]; symbols: any[] }>(
    'GET',
    'https://fapi.binance.com/fapi/v1/exchangeInfo',
  );

export const getFutureFundingRate = (params: { symbol?: string; startTime?: number; endTime?: number; limit?: number }) =>
  requestPublic<
    {
      symbol: string;
      fundingTime: number;
      fundingRate: string;
      markPrice: string;
    }[]
  >('GET', 'https://fapi.binance.com/fapi/v1/fundingRate', params);

export const getFuturePremiumIndex = (params: { symbol?: string }) =>
  requestPublic<
    {
      symbol: string;
      markPrice: string;
      indexPrice: string;
      estimatedSettlePrice: string;
      lastFundingRate: string;
      interestRate: string;
      nextFundingTime: number;
      time: number;
    }[]
  >('GET', 'https://fapi.binance.com/fapi/v1/premiumIndex', params);

export const getFutureBookTicker = (params?: { symbol?: string }) =>
  requestPublic<
    {
      symbol: string;
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
      time: number;
    }[]
  >('GET', 'https://fapi.binance.com/fapi/v1/ticker/bookTicker', params);

export const getFutureOpenInterest = (params: { symbol: string }) =>
  requestPublic<{ openInterest: string; symbol: string; time: number }>('GET', 'https://fapi.binance.com/fapi/v1/openInterest', params);

export const getMarginAllPairs = (params?: { symbol?: string }) =>
  requestPublic<
    {
      id: string;
      symbol: string;
      base: string;
      quote: string;
      isMarginTrade: boolean;
      isBuyAllowed: boolean;
      isSellAllowed: boolean;
    }[]
  >('GET', 'https://api.binance.com/sapi/v1/margin/allPairs', params);
