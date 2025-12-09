import { requestPublic, requestPublicWithFlowControl } from './client';

type ApiResponse<T> = {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
};

export interface IUtaInstrument {
  category: string;
  symbol: string;
  isRwa?: string;
  baseCoin: string;
  quoteCoin: string;
  buyLimitPriceRatio: string;
  sellLimitPriceRatio: string;
  feeRateUpRatio?: string;
  openCostUpRatio?: string;
  minOrderQty?: string;
  maxOrderQty?: string;
  minOrderAmount?: string;
  pricePrecision: string;
  quantityPrecision: string;
  quotePrecision?: string;
  priceMultiplier?: string;
  quantityMultiplier?: string;
  symbolType?: string;
  maxSymbolOrderNum?: string;
  maxProductOrderNum?: string;
  maxPositionNum?: string;
  status: string;
  offTime?: string;
  limitOpenTime?: string;
  deliveryTime?: string;
  deliveryStartTime?: string;
  deliveryPeriod?: string;
  launchTime?: string;
  fundInterval?: string;
  minLeverage?: string;
  maxLeverage?: string;
  maintainTime?: string;
  maxMarketOrderQty?: string;
  isIsolatedBaseBorrowable?: string;
  isIsolatedQuotedBorrowable?: string;
  warningRiskRatio?: string;
  liquidationRiskRatio?: string;
  maxCrossedLeverage?: string;
  maxIsolatedLeverage?: string;
  userMinBorrow?: string;
  areaSymbol?: string;
}

export interface IUtaTicker {
  category: string;
  symbol: string;
  lastPrice: string;
  openPrice24h: string;
  highPrice24h: string;
  lowPrice24h: string;
  ask1Price: string;
  bid1Price: string;
  bid1Size: string;
  ask1Size: string;
  price24hPcnt: string;
  volume24h: string;
  turnover24h: string;
  indexPrice?: string;
  markPrice?: string;
  fundingRate?: string;
  openInterest?: string;
  deliveryStartTime?: string;
  deliveryTime?: string;
  deliveryStatus?: string;
  ts?: string;
}

export interface IUtaOpenInterestRow {
  symbol: string;
  openInterest: string;
}

export interface IUtaCurrentFundingRate {
  symbol: string;
  fundingRate: string;
  fundingRateInterval: string;
  nextUpdate: string;
  minFundingRate: string;
  maxFundingRate: string;
}

export interface IUtaHistoricalFundingRate {
  symbol: string;
  fundingRate: string;
  fundingRateTimestamp: string;
}

/**
 * 获取交易产品
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Instruments
 */
export const getInstruments = (params: { category: string; symbol?: string }) =>
  requestPublic<ApiResponse<IUtaInstrument[]>>('GET', '/api/v3/market/instruments', params);

/**
 * 获取行情 Tickers
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Tickers
 */
export const getTickers = (params: { category: string; symbol?: string }) =>
  requestPublic<ApiResponse<IUtaTicker[]>>('GET', '/api/v3/market/tickers', params);

/**
 * 获取持仓量
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Get-Open-Interest
 */
export const getOpenInterestV3 = (params: { category: string; symbol?: string }) =>
  requestPublic<ApiResponse<{ list: IUtaOpenInterestRow[]; ts: string }>>(
    'GET',
    '/api/v3/market/open-interest',
    params,
  );

/**
 * 获取当前资金费率
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Get-Current-Funding-Rate
 */
export const getCurrentFundingRate = (params: { symbol: string }) =>
  requestPublic<ApiResponse<IUtaCurrentFundingRate[]>>('GET', '/api/v3/market/current-fund-rate', params);

/**
 * 获取历史资金费率
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Get-History-Funding-Rate
 */
export const getHistoryFundingRate = (params: {
  category: string;
  symbol: string;
  cursor?: string;
  limit?: string;
}) =>
  requestPublicWithFlowControl<ApiResponse<{ resultList: IUtaHistoricalFundingRate[] }>>(
    'GET',
    '/api/v3/market/history-fund-rate',
    { period: 1000, limit: 20 },
    params,
  );

/**
 * 获取历史 K 线
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/public/Get-History-Candle-Data
 */
export const getHistoryCandles = (params: {
  category: string;
  symbol: string;
  interval: string;
  startTime?: string;
  endTime?: string;
  type?: string;
  limit?: string;
}) =>
  requestPublic<ApiResponse<[string, string, string, string, string, string, string][]>>(
    'GET',
    '/api/v3/market/history-candles',
    params,
  );
