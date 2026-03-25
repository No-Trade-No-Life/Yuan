import { scopeError, tokenBucket } from '@yuants/utils';
import { createRequestContext, getTokenBucketOptions, requestPublic } from './client';

export type IBinanceKline = [
  number, // Open time
  string, // Open
  string, // High
  string, // Low
  string, // Close
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base asset volume
  string, // Taker buy quote asset volume
  string, // Ignore
];

export interface IBinanceKlineParams extends Record<string, string | number | boolean | undefined> {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

type PublicRequestParams = Record<string, string | number | boolean | undefined>;

const requestPublicWithRateLimit = async <T, TParams extends PublicRequestParams = PublicRequestParams>(
  endpoint: string,
  weight: number,
  params?: TParams,
) => {
  const url = new URL(endpoint);
  const baseKey = url.host;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<T>('GET', endpoint, params, requestContext);
};

const getFutureKlineWeight = (limit?: number) => {
  const normalizedLimit = Math.max(1, limit ?? 500);
  if (normalizedLimit < 100) return 1;
  if (normalizedLimit < 500) return 2;
  if (normalizedLimit <= 1000) return 5;
  return 10;
};

/**
 * 获取 Kline/Candlestick 数据 (Futures)
 *
 * 权重: [1,100)=1, [100,500)=2, [500,1000]=5, >1000=10
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Kline-Candlestick-Data
 */
export const getFutureKlines = async (params: IBinanceKlineParams): Promise<IBinanceKline[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/klines';
  const weight = getFutureKlineWeight(params.limit);
  return requestPublicWithRateLimit<IBinanceKline[]>(endpoint, weight, params);
};

/**
 * 获取 Kline/Candlestick 数据 (Spot/Margin)
 *
 * 权重: 2
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/market-data-endpoints#k线数据
 */
export const getSpotKlines = async (params: IBinanceKlineParams): Promise<IBinanceKline[]> => {
  const endpoint = 'https://api.binance.com/api/v3/klines';
  return requestPublicWithRateLimit<IBinanceKline[]>(endpoint, 2, params);
};

export interface IFutureExchangeFilter extends Record<string, string | number | boolean | undefined> {
  filterType: string;
}

export interface IFutureExchangeSymbol {
  symbol: string;
  pair: string;
  contractType: string;
  deliveryDate: number;
  onboardDate: number;
  status: string;
  maintMarginPercent: string;
  requiredMarginPercent: string;
  baseAsset: string;
  quoteAsset: string;
  marginAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  baseAssetPrecision: number;
  quotePrecision: number;
  underlyingType: string;
  underlyingSubType: string[];
  settlePlan: number;
  triggerProtect: string;
  liquidationFee: string;
  marketTakeBound: string;
  maxMoveOrderLimit: number;
  filters: IFutureExchangeFilter[];
  orderTypes: string[];
  timeInForce: string[];
}

export interface IFutureExchangeInfo {
  timezone: string;
  serverTime: number;
  futuresType: string;
  rateLimits: {
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }[];
  exchangeFilters: unknown[];
  assets: {
    asset: string;
    marginAvailable: boolean;
    autoAssetExchange: string;
  }[];
  symbols: IFutureExchangeSymbol[];
}

export interface IFutureFundingRateEntry {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice: string;
}

export interface IFutureFundingInfoEntry {
  symbol: string;
  adjustedFundingRateCap: string;
  adjustedFundingRateFloor: string;
  fundingIntervalHours: number;
  disclaimer: boolean;
}

export interface IFuturePremiumIndexEntry {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  interestRate: string;
  nextFundingTime: number;
  time: number;
}

export interface IFutureBookTickerEntry {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  time: number;
}

export interface IFutureOpenInterest {
  openInterest: string;
  symbol: string;
  time: number;
}

export interface IMarginPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  isMarginTrade: boolean;
  isBuyAllowed: boolean;
  isSellAllowed: boolean;
}

/**
 * 获取交易规则和交易对
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Exchange-Information
 */
export const getFutureExchangeInfo = async (): Promise<IFutureExchangeInfo> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = 1;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFutureExchangeInfo>('GET', endpoint, undefined, requestContext);
};

/**
 * 查询资金费率历史
 *
 * 权重: /fapi/v1/fundingInfo共享500/5min/IP
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History
 */
export const getFutureFundingRate = async (params: {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<IFutureFundingRateEntry[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/fundingRate';
  const url = new URL(endpoint);
  const baseKey = `${url.host}fundingRate`;
  const weight = 1;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () =>
      tokenBucket(bucketKey, {
        capacity: 500,
        refillAmount: 500,
        refillInterval: 300_000,
      }).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFutureFundingRateEntry[]>('GET', endpoint, params, requestContext);
};

/**
 * 查询资金费率信息
 *
 * 权重: /fapi/v1/fundingRate共享500/5min/IP
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-Info
 */
export const getFutureFundingInfo = async (): Promise<IFutureFundingInfoEntry[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/fundingInfo';
  const url = new URL(endpoint);
  const baseKey = `${url.host}fundingRate`;
  const weight = 1;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () =>
      tokenBucket(bucketKey, {
        capacity: 500,
        refillAmount: 500,
        refillInterval: 300_000,
      }).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFutureFundingInfoEntry[]>('GET', endpoint, undefined, requestContext);
};

/**
 * 最新标记价格和资金费率
 *
 * 采集各大交易所数据加权平均
 *
 * 权重: 带symbol为1；不带symbol为10
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price
 */
export const getFuturePremiumIndex = async (params: {
  symbol?: string;
}): Promise<IFuturePremiumIndexEntry[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/premiumIndex';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = params?.symbol ? 1 : 10;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: bucketKey,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFuturePremiumIndexEntry[]>('GET', endpoint, params, requestContext);
};

/**
 * 当前最优挂单
 *
 * 返回当前最优的挂单(最高买单，最低卖单)
 *
 * 权重: 单交易对2，无交易对5
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Symbol-Order-Book-Ticker
 */
export const getFutureBookTicker = async (params?: {
  symbol?: string;
}): Promise<IFutureBookTickerEntry[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/ticker/bookTicker';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = params?.symbol ? 2 : 5;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: bucketKey,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFutureBookTickerEntry[]>('GET', endpoint, params, requestContext);
};

/**
 * 获取未平仓合约数
 *
 * 权重: 1
 *
 * 更新速率: 3s
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest
 */
export const getFutureOpenInterest = async (params: { symbol: string }): Promise<IFutureOpenInterest> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/openInterest';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = 1;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<IFutureOpenInterest>('GET', endpoint, params, requestContext);
};
export interface ISpotBookTickerEntry {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

/**
 * 当前最优挂单 (Spot)
 *
 * 权重: 单交易对 2，不带 symbol 4
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/market-data-endpoints#%E6%9C%80%E4%BC%98%E6%8C%82%E5%8D%95%E6%8E%A5%E5%8F%A3
 */
export const getSpotBookTicker = async (params?: { symbol?: string }): Promise<ISpotBookTickerEntry[]> => {
  const endpoint = 'https://api.binance.com/api/v3/ticker/bookTicker';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = params?.symbol ? 2 : 4;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: bucketKey,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<ISpotBookTickerEntry[]>('GET', endpoint, params, requestContext);
};

export interface ISpotExchangeFilter extends Record<string, string | number | boolean | undefined> {
  filterType: string;
}

export interface ISpotExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: ISpotExchangeFilter[];
  permissions: string[];
}

export interface ISpotExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: {
    rateLimitType: string;
    interval: string;
    intervalNum: number;
    limit: number;
  }[];
  exchangeFilters: unknown[];
  symbols: ISpotExchangeSymbol[];
}

/**
 * 获取现货交易规则和交易对
 *
 * 权重: 20
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/general-endpoints#%E4%BA%A4%E6%98%93%E8%A7%84%E8%8C%83%E4%BF%A1%E6%81%AF
 */
export const getSpotExchangeInfo = async (): Promise<ISpotExchangeInfo> => {
  const endpoint = 'https://api.binance.com/api/v3/exchangeInfo';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = 20;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<ISpotExchangeInfo>('GET', endpoint, undefined, requestContext);
};

/**
 * 获取当前现货报价
 *
 * 权重: 单交易对 2，不带 symbol 4
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/market-data-endpoints#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC%E6%8E%A5%E5%8F%A3
 */
export const getSpotTickerPrice = async (params?: {
  symbol?: string;
  symbols?: string;
  symbolStatus?: string;
}): Promise<
  {
    symbol: string;
    price: string;
  }[]
> => {
  const endpoint = 'https://api.binance.com/api/v3/ticker/price';
  const url = new URL(endpoint);
  const baseKey = url.host;
  const weight = params?.symbol ? 2 : 4;
  const requestContext = await createRequestContext(baseKey, weight);
  const bucketKey = requestContext.bucketKey;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(requestContext.acquireWeight),
  );
  return requestPublic<
    {
      symbol: string;
      price: string;
    }[]
  >('GET', endpoint, params, requestContext);
};
