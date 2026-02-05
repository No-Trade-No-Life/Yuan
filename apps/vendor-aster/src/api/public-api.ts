import { fetch, selectHTTPProxyIpRoundRobin } from '@yuants/http-services';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { encodePath, formatTime, scopeError, tokenBucket } from '@yuants/utils';

import { ASTER_TOKEN_BUCKET_OPTIONS_BY_ID } from './client';

const MetricsAsterApiCallCounter = GlobalPrometheusRegistry.counter(
  'aster_api_call',
  'Number of aster api call',
);
const terminal = Terminal.fromNodeEnv();
const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;
const MISSING_PUBLIC_IP_LOG_INTERVAL = 3_600_000;
const missingPublicIpLogAtByTerminalId = new Map<string, number>();

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

const FutureBaseURL = 'https://fapi.asterdex.com';
const SpotBaseURL = 'https://sapi.asterdex.com';

type RequestContext = { ip: string };

const buildTokenBucketKey = (baseKey: string, ip: string): string => encodePath([baseKey, ip]);

const getTokenBucketOptions = (baseKey: string) => ASTER_TOKEN_BUCKET_OPTIONS_BY_ID[baseKey];

const resolveLocalPublicIp = (): string => {
  const ip = terminal.terminalInfo.tags?.public_ip?.trim();
  if (ip) return ip;
  const now = Date.now();
  const lastLoggedAt = missingPublicIpLogAtByTerminalId.get(terminal.terminal_id) ?? 0;
  if (now - lastLoggedAt > MISSING_PUBLIC_IP_LOG_INTERVAL) {
    missingPublicIpLogAtByTerminalId.set(terminal.terminal_id, now);
    console.info(formatTime(Date.now()), 'missing terminal public_ip tag, fallback to public-ip-unknown');
  }
  return 'public-ip-unknown';
};

const createRequestContext = (): RequestContext => {
  if (shouldUseHttpProxy) {
    const ip = selectHTTPProxyIpRoundRobin(terminal);
    return { ip };
  }
  return { ip: resolveLocalPublicIp() };
};

const acquireRateLimit = (url: URL, endpoint: string, weight: number, requestContext: RequestContext) => {
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
};

const getKlinesRequestWeight = (limit: number | undefined): number => {
  const resolvedLimit = limit ?? 500;
  if (resolvedLimit < 100) return 1;
  if (resolvedLimit < 500) return 2;
  if (resolvedLimit <= 1000) return 5;
  return 10;
};

const request = async <T>(
  method: string,
  baseUrl: string,
  endpoint: string,
  params: Record<string, unknown> = {},
  requestContext: RequestContext,
): Promise<T> => {
  const url = new URL(baseUrl);
  url.pathname = endpoint;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, `${value}`);
  }

  console.info(url.toString());
  MetricsAsterApiCallCounter.labels({ path: url.pathname, terminal_id: terminal.terminal_id }).inc();
  const response = (await fetchImpl(
    url.toString(),
    shouldUseHttpProxy
      ? {
          method,
          labels: requestContext.ip ? { ip: requestContext.ip } : undefined,
          terminal,
        }
      : { method },
  )) as Response;
  const res = (await response.json()) as unknown;

  const maybeError = res as { code?: number };
  if (typeof maybeError.code === 'number' && maybeError.code !== 0) {
    throw JSON.stringify(res);
  }
  return res as T;
};

/**
 * 获取资金费率历史
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E6%9F%A5%E8%AF%A2%E8%B5%84%E9%87%91%E8%B4%B9%E7%8E%87%E5%8E%86%E5%8F%B2
 */
export const getFApiV1FundingRate = (params: {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<
  {
    symbol: string;
    fundingRate: string;
    fundingTime: number;
  }[]
> => {
  const endpoint = '/fapi/v1/fundingRate';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

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
      [key: string]: unknown;
    }[];
  }[];
  rateLimits?: IAsterRateLimit[];
}

/**
 * 获取交易对信息
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E4%BA%A4%E6%98%93%E5%AF%B9%E4%BF%A1%E6%81%AF
 */
export const getFApiV1ExchangeInfo = (params: Record<string, never>): Promise<IAsterExchangeInfo> => {
  const endpoint = '/fapi/v1/exchangeInfo';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 获取现货交易对信息
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1080-L1145
 */
export const getApiV1ExchangeInfo = (params: Record<string, never>): Promise<IAsterExchangeInfo> => {
  const endpoint = '/api/v1/exchangeInfo';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * 获取未平仓合约数量
 *
 * 无 API 文档 (weird)
 * 参考 Binance 风格接口：/fapi/v1/openInterest
 *
 * Weight: 1
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest
 */
export const getFApiV1OpenInterest = (params: {
  symbol: string;
}): Promise<{
  symbol: string;
  openInterest: string;
  time: number;
}> => {
  const endpoint = '/fapi/v1/openInterest';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 获取最新价格
 *
 * Weight: without symbol 2 (current implementation)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getFApiV1TickerPrice = (
  params: Record<string, never>,
): Promise<
  {
    symbol: string;
    price: string;
    time?: number;
  }[]
> => {
  const endpoint = '/fapi/v1/ticker/price';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 2;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 获取资金费率
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md
 */
export const getFApiV1PremiumIndex = (params: {
  symbol?: string;
}): Promise<
  | {
      symbol: string;
      markPrice: string;
      indexPrice: string;
      estimatedSettlePrice: string;
      lastFundingRate: string;
      nextFundingTime: number;
      interestRate: string;
      time: number;
    }
  | {
      symbol: string;
      markPrice: string;
      indexPrice: string;
      estimatedSettlePrice: string;
      lastFundingRate: string;
      nextFundingTime: number;
      interestRate: string;
      time: number;
    }[]
> => {
  const endpoint = '/fapi/v1/premiumIndex';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = createRequestContext();
  acquireRateLimit(url, endpoint, weight, requestContext);
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

export interface IAsterKline extends Array<string | number> {
  0: number; // Open time
  1: string; // Open
  2: string; // High
  3: string; // Low
  4: string; // Close
  5: string; // Volume
  6: number; // Close time
  7: string; // Quote asset volume
  8: number; // Number of trades
  9: string; // Taker buy base asset volume
  10: string; // Taker buy quote asset volume
  11: string; // Ignore
}

/**
 * 获取 K 线
 *
 * 参考 Binance 风格接口：/fapi/v1/klines
 *
 * Weight: by limit
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#k%E7%BA%BF%E6%95%B0%E6%8D%AE
 */
export const getFApiV1Klines = (params: {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<IAsterKline[]> => {
  const endpoint = '/fapi/v1/klines';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = getKlinesRequestWeight(params?.limit);
  const requestContext = createRequestContext();
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: buildTokenBucketKey(url.host, requestContext.ip),
      weight,
      limit: params?.limit,
    },
    () =>
      tokenBucket(
        buildTokenBucketKey(url.host, requestContext.ip),
        getTokenBucketOptions(url.host),
      ).acquireSync(weight),
  );
  return request('GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 获取现货 K 线
 *
 * 参考 Binance 风格接口：/api/v1/klines
 *
 * Weight: not documented (temporary: follow futures limit table)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md
 */
export const getApiV1Klines = (params: {
  symbol: string;
  interval: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<IAsterKline[]> => {
  const endpoint = '/api/v1/klines';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = getKlinesRequestWeight(params?.limit);
  const requestContext = createRequestContext();
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: buildTokenBucketKey(url.host, requestContext.ip),
      weight,
      limit: params?.limit,
    },
    () =>
      tokenBucket(
        buildTokenBucketKey(url.host, requestContext.ip),
        getTokenBucketOptions(url.host),
      ).acquireSync(weight),
  );
  return request('GET', SpotBaseURL, endpoint, params, requestContext);
};
