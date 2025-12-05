const BASE_URL = 'https://fapi.asterdex.com';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';

const MetricsAsterApiCallCounter = GlobalPrometheusRegistry.counter(
  'aster_api_call',
  'Number of aster api call',
);
const terminal = Terminal.fromNodeEnv();
const request = async <T>(method: string, endpoint: string, params: any = {}): Promise<T> => {
  const url = new URL(BASE_URL);
  url.pathname = endpoint;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, `${value}`);
  }

  console.info(url.toString());
  MetricsAsterApiCallCounter.labels({ path: url.pathname, terminal_id: terminal.terminal_id }).inc();
  const res = await fetch(url.toString(), {
    method,
  }).then((response) => response.json());
  if (res.code && res.code !== 0) {
    throw JSON.stringify(res);
  }
  return res;
};

const createApi =
  <TReq, TRes>(method: string, endpoint: string) =>
  (params: TReq) =>
    request<TRes>(method, endpoint, params);

/**
 * 获取资金费率历史
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E6%9F%A5%E8%AF%A2%E8%B5%84%E9%87%91%E8%B4%B9%E7%8E%87%E5%8E%86%E5%8F%B2
 */
export const getFApiV1FundingRate = createApi<
  {
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  },
  {
    symbol: string;
    fundingRate: string;
    fundingTime: number;
  }[]
>('GET', '/fapi/v1/fundingRate');

export interface IAsterRateLimit {
  rateLimitType?: string;
  interval?: string;
  intervalNum?: number;
  limit?: number;
}

export interface IAsterExchangeInfo {
  symbols: {
    symbol: string;
    status: 'TRADING' | 'BREAK' | 'HALT';
    baseAsset: string;
    quoteAsset: string;
    pricePrecision: number;
    quantityPrecision: number;
    baseAssetPrecision: number;
    quotePrecision: number;
    filters: {
      filterType: string;
      [key: string]: any;
    }[];
  }[];
  rateLimits?: IAsterRateLimit[];
}

/**
 * 获取交易对信息
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E4%BA%A4%E6%98%93%E5%AF%B9%E4%BF%A1%E6%81%AF
 */
export const getFApiV1ExchangeInfo = createApi<{}, IAsterExchangeInfo>('GET', '/fapi/v1/exchangeInfo');

/**
 * 获取未平仓合约数量
 *
 * 无 API 文档 (weird)
 */
export const getFApiV1OpenInterest = createApi<
  {
    symbol: string;
  },
  {
    symbol: string;
    openInterest: string;
    time: number;
  }
>('GET', '/fapi/v1/openInterest');

/**
 * 获取最新价格
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getFApiV1TickerPrice = createApi<
  {},
  {
    symbol: string;
    price: string;
    time?: number;
  }[]
>('GET', '/fapi/v1/ticker/price');

/**
 * 获取资金费率
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md
 */
export const getFApiV1PremiumIndex = createApi<
  {
    symbol?: string;
  },
  | {
      symbol: string; // 交易对
      markPrice: string; // 标记价格
      indexPrice: string; // 指数价格
      estimatedSettlePrice: string; // 预估结算价,仅在交割开始前最后一小时有意义
      lastFundingRate: string; // 最近更新的资金费率
      nextFundingTime: number; // 下次资金费时间
      interestRate: string; // 标的资产基础利率
      time: number; // 更新时间
    }
  | {
      symbol: string; // 交易对
      markPrice: string; // 标记价格
      indexPrice: string; // 指数价格
      estimatedSettlePrice: string; // 预估结算价,仅在交割开始前最后一小时有意义
      lastFundingRate: string; // 最近更新的资金费率
      nextFundingTime: number; // 下次资金费时间
      interestRate: string; // 标的资产基础利率
      time: number; // 更新时间
    }[]
>('GET', '/fapi/v1/premiumIndex');
