import { requestPublic, requestPublicWithFlowControl } from './client';

type ApiResponse<T> = {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
};

export interface IMixMarketContract {
  symbol: string;
  productType: string;
  baseCoin: string;
  quoteCoin: string;
  pricePlace: string;
  sizeMultiplier: string;
}

export interface IMixMarketSymbol {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
}

export interface IMarginCurrency {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  maxCrossedLeverage: string;
  maxIsolatedLeverage: string;
  warningRiskRatio: string;
  liquidationRiskRatio: string;
  minTradeAmount: string;
  maxTradeAmount: string;
  takerFeeRate: string;
  makerFeeRate: string;
  pricePrecision: string;
  quantityPrecision: string;
  minTradeUSDT: string;
  isBorrowable: boolean;
  userMinBorrow: string;
  status: string;
  isIsolatedBaseBorrowable: boolean;
  isIsolatedQuoteBorrowable: boolean;
  isCrossBorrowable: boolean;
}

export interface IFutureMarketTicker {
  symbol: string;
  productType: string;
  lastPr: string;
  askPr: string;
  askSz: string;
  bidPr: string;
  bidSz: string;
  fundingRate: string;
  holdingAmount: string;
  high24h?: string;
  low24h?: string;
  ts?: string;
}

export interface IFundingTimeInfo {
  symbol: string;
  productType: string;
  nextFundingTime: string;
  ratePeriod: string;
}

export interface IHistoricalFundingRate {
  symbol: string;
  productType: string;
  fundingRate: string;
  fundingTime: string;
  ratePeriod: string;
}

/**
 * 获取合约信息
 *
 * 20次/S 根据ip限频
 *
 * 获取合约详情信息。
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-All-Symbols-Contracts
 */
export const getMarketContracts = (params: {
  symbol?: string;
  productType: string;
}): Promise<ApiResponse<IMixMarketContract[]>> =>
  requestPublic<ApiResponse<IMixMarketContract[]>>('GET', '/api/v2/mix/market/contracts', params);

/**
 * 获取支持杠杆的所有交易对
 * 限速规则 10次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/margin/common/support-currencies
 */
export const getMarginCurrencies = (): Promise<ApiResponse<IMarginCurrency[]>> =>
  requestPublic<ApiResponse<IMarginCurrency[]>>('GET', '/api/v2/margin/currencies');

/**
 * 获取单个交易对行情
 *
 * 限速规则: 20次/1s (IP)
 *
 * 获取指定产品类型下，单个交易对的行情数据
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Ticker
 */
export const getFutureMarketTicker = (params: {
  symbol: string;
  productType: string;
}): Promise<ApiResponse<IFutureMarketTicker>> =>
  requestPublic<ApiResponse<IFutureMarketTicker>>('GET', '/api/v2/mix/market/ticker', params);

/**
 * 获取全部交易对行情
 *
 * 限速规则: 20次/1s (IP)
 *
 * 获取指定产品类型下，全部交易对的行情数据
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-All-Symbol-Ticker
 */
export const getFutureMarketTickers = (params: {
  productType: string;
}): Promise<ApiResponse<IFutureMarketTicker[]>> =>
  requestPublic<ApiResponse<IFutureMarketTicker[]>>('GET', '/api/v2/mix/market/tickers', params);

/**
 * 获取平台总持仓量
 *
 * 限速规则: 20次/1s (IP)
 *
 * 获取某交易对在平台的总持仓量
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Open-Interest
 */
export const getOpenInterest = (params: {
  symbol: string;
  productType: string;
}): Promise<ApiResponse<{ symbol: string; amount: string }[]>> =>
  requestPublic<ApiResponse<{ symbol: string; amount: string }[]>>(
    'GET',
    '/api/v2/mix/market/open-interest',
    params,
  );

/**
 * 获取下次资金费结算时间
 *
 * 限速规则: 20次/1s (IP)
 *
 * 获取合约下一次的结算时间以及该合约的结算周期
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Symbol-Next-Funding-Time
 */
export const getNextFundingTime = (params: {
  symbol: string;
  productType: string;
}): Promise<ApiResponse<IFundingTimeInfo[]>> =>
  requestPublicWithFlowControl<ApiResponse<IFundingTimeInfo[]>>(
    'GET',
    '/api/v2/mix/market/funding-time',
    { period: 1000, limit: 20 },
    params,
  );

/**
 * 获取历史资金费率
 *
 * 限速规则: 20次/1s (IP)
 *
 * 获取合约的历史资金费率
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-History-Funding-Rate
 */
export const getHistoricalFundingRate = (params: {
  symbol: string;
  productType: string;
  pageSize?: string;
  pageNo?: string;
}): Promise<ApiResponse<IHistoricalFundingRate[]>> =>
  requestPublicWithFlowControl<ApiResponse<IHistoricalFundingRate[]>>(
    'GET',
    '/api/v2/mix/market/history-fund-rate',
    { period: 1000, limit: 20 },
    params,
  );
