import { requestPublic } from './client';

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
 * https://binance-docs.github.io/apidocs/futures/cn/#0f3f2d5ee7
 */
export const getFutureExchangeInfo = (): Promise<IFutureExchangeInfo> =>
  requestPublic<IFutureExchangeInfo>('GET', 'https://fapi.binance.com/fapi/v1/exchangeInfo');

/**
 * 查询资金费率历史
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History
 */
export const getFutureFundingRate = (params: {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<IFutureFundingRateEntry[]> =>
  requestPublic<IFutureFundingRateEntry[]>('GET', 'https://fapi.binance.com/fapi/v1/fundingRate', params);

/**
 * 最新标记价格和资金费率
 *
 * 采集各大交易所数据加权平均
 *
 * 权重: 带symbol为1；不带symbol为10
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Mark-Price
 */
export const getFuturePremiumIndex = (params: { symbol?: string }): Promise<IFuturePremiumIndexEntry[]> =>
  requestPublic<IFuturePremiumIndexEntry[]>('GET', 'https://fapi.binance.com/fapi/v1/premiumIndex', params);

/**
 * 当前最优挂单
 *
 * 返回当前最优的挂单(最高买单，最低卖单)
 *
 * 权重: 单交易对2，无交易对5
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Symbol-Order-Book-Ticker
 */
export const getFutureBookTicker = (params?: { symbol?: string }): Promise<IFutureBookTickerEntry[]> =>
  requestPublic<IFutureBookTickerEntry[]>(
    'GET',
    'https://fapi.binance.com/fapi/v1/ticker/bookTicker',
    params,
  );

/**
 * 获取未平仓合约数
 *
 * 权重: 1
 *
 * 更新速率: 3s
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest
 */
export const getFutureOpenInterest = (params: { symbol: string }): Promise<IFutureOpenInterest> =>
  requestPublic<IFutureOpenInterest>('GET', 'https://fapi.binance.com/fapi/v1/openInterest', params);
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
 * https://binance-docs.github.io/apidocs/spot/cn/#5393cd0851
 */
export const getSpotBookTicker = (params?: { symbol?: string }): Promise<ISpotBookTickerEntry[]> =>
  requestPublic<ISpotBookTickerEntry[]>('GET', 'https://api.binance.com/api/v3/ticker/bookTicker', params);

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
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/general-endpoints#%E4%BA%A4%E6%98%93%E8%A7%84%E8%8C%83%E4%BF%A1%E6%81%AF
 */
export const getSpotExchangeInfo = (): Promise<ISpotExchangeInfo> =>
  requestPublic<ISpotExchangeInfo>('GET', 'https://api.binance.com/api/v3/exchangeInfo');

/**
 * 获取当前现货报价
 *
 *https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/market-data-endpoints#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC%E6%8E%A5%E5%8F%A3
 */
export const getSpotTickerPrice = (params?: {
  symbol?: string;
  symbols?: string;
  symbolStatus?: 'TRADING' | 'HALT' | 'BREAK';
}): Promise<
  | {
      symbol: string;
      price: string;
    }
  | {
      symbol: string;
      price: string;
    }[]
> =>
  requestPublic<
    | {
        symbol: string;
        price: string;
      }
    | {
        symbol: string;
        price: string;
      }[]
  >('GET', 'https://api.binance.com/api/v3/ticker/price', params);
