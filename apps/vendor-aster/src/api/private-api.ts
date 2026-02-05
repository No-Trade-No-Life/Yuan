import { fetch, selectHTTPProxyIpRoundRobinAsync } from '@yuants/http-services';
import {
  encodeHex,
  encodePath,
  formatTime,
  HmacSHA256,
  newError,
  scopeError,
  tokenBucket,
} from '@yuants/utils';

import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';

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

export interface ICredential {
  address: string;
  api_key: string;
  secret_key: string;
}

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

const createRequestContext = async (): Promise<RequestContext> => {
  if (shouldUseHttpProxy) {
    const ip = await selectHTTPProxyIpRoundRobinAsync(terminal);
    return { ip };
  }
  return { ip: resolveLocalPublicIp() };
};

const acquireRateLimit = (
  method: string,
  url: URL,
  endpoint: string,
  weight: number,
  requestContext: RequestContext,
) => {
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method, endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
};

export interface IAsterFutureOpenOrder {
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  updateTime: number;
  avgPrice: string;
  reduceOnly?: boolean;
  closePosition?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  workingType?: string;
  priceProtect?: boolean;
  origType?: string;
  stopPrice?: string;
  symbol: string;
}

export interface IAsterSpotOpenOrder {
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty?: string;
  status: string;
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking?: boolean;
  avgPrice?: string;
  symbol: string;
}

const request = async <T>(
  credential: ICredential,
  method: string,
  baseURL: string,
  endpoint: string,
  params: Record<string, unknown> = {},
  requestContext: RequestContext,
): Promise<T> => {
  const url = new URL(baseURL);
  url.pathname = endpoint;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, `${value}`);
  }

  url.searchParams.set('timestamp', `${Date.now()}`);
  const msg = url.search.slice(1); // 去掉开头的 '?'
  const signature = encodeHex(
    await HmacSHA256(new TextEncoder().encode(msg), new TextEncoder().encode(credential.secret_key)),
  );
  url.searchParams.set('signature', signature);

  console.info('request', method, url.host, url.pathname);
  MetricsAsterApiCallCounter.labels({ path: url.pathname, terminal_id: terminal.terminal_id }).inc();
  const response = await fetchImpl(
    url.toString(),
    shouldUseHttpProxy
      ? {
          method,
          headers: {
            'X-MBX-APIKEY': credential.api_key,
          },
          labels: requestContext.ip ? { ip: requestContext.ip } : undefined,
          terminal,
        }
      : {
          method,
          headers: {
            'X-MBX-APIKEY': credential.api_key,
          },
        },
  );

  const resText = await response.text();

  try {
    const res = JSON.parse(resText);

    if (res.code && res.code !== 0) {
      throw resText;
    }
    return res;
  } catch (e) {
    throw newError(
      'ASTER_API_ERROR',
      {
        status: response.status,
        statusText: response.statusText,
        resText,
        params,
      },
      e,
    );
  }
};

const FutureBaseURL = 'https://fapi.asterdex.com';
const SpotBaseURL = 'https://sapi.asterdex.com';

/**
 * 获取账户信息
 *
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AFv4-user_data
 */
export const getFApiV4Account = async (
  credential: ICredential,
  params: Record<string, never>,
): Promise<{
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: {
    asset: string;
    walletBalance: string;
    unrealizedProfit: string;
    marginBalance: string;
    maintMargin: string;
    initialMargin: string;
    positionInitialMargin: string;
    openOrderInitialMargin: string;
    maxWithdrawAmount: string;
    crossWalletBalance: string;
    crossUnPnl: string;
    availableBalance: string;
    marginAvailable: boolean;
    updateTime: number;
  }[];
  positions: {
    symbol: string;
    initialMargin: string;
    maintMargin: string;
    unrealizedProfit: string;
    positionInitialMargin: string;
    openOrderInitialMargin: string;
    leverage: string;
    isolated: boolean;
    entryPrice: string;
    maxNotional: string;
    positionSide: 'BOTH' | 'LONG' | 'SHORT';
    positionAmt: string;
    notional: string;
    isolatedWallet: string;
    updateTime: number;
  }[];
}> => {
  const endpoint = '/fapi/v4/account';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 5;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 用户持仓风险V2 (USER_DATA)
 *
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E7%94%A8%E6%88%B7%E6%8C%81%E4%BB%93%E9%A3%8E%E9%99%A9v2-user_data
 */
export const getFApiV2PositionRisk = async (
  credential: ICredential,
  params: {
    symbol?: string;
  },
): Promise<
  {
    entryPrice: string;
    marginType: string;
    isAutoAddMargin: string;
    isolatedMargin: string;
    leverage: string;
    liquidationPrice: string;
    markPrice: string;
    maxNotionalValue: string;
    positionAmt: string;
    symbol: string;
    unRealizedProfit: string;
    positionSide: string;
    updateTime: number;
  }[]
> => {
  const endpoint = '/fapi/v2/positionRisk';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 5;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2840-L2855
 */
export const getFApiV2Balance = async (
  credential: ICredential,
  params: Record<string, never>,
): Promise<
  {
    accountAlias: string;
    asset: string;
    balance: string;
    crossWalletBalance: string;
    crossUnPnl: string;
    availableBalance: string;
    maxWithdrawAmount: string;
    marginAvailable: boolean;
    updateTime: number;
  }[]
> => {
  const endpoint = '/fapi/v2/balance';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 5;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * Weight: 1 by order
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#post-fapiv1order-%E7%9A%84%E7%A4%BA%E4%BE%8B
 */
export const postFApiV1Order = async (
  credential: ICredential,
  params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
    type:
      | 'MARKET'
      | 'LIMIT'
      | 'STOP'
      | 'STOP_MARKET'
      | 'TAKE_PROFIT'
      | 'TAKE_PROFIT_MARKET'
      | 'TRAILING_STOP_MARKET';
    reduceOnly?: 'true' | 'false';
    quantity?: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX' | 'HIDDEN';
  },
): Promise<Record<string, never>> => {
  const endpoint = '/fapi/v1/order';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = await createRequestContext();
  const secondBucketKey = buildTokenBucketKey('order/future/second', requestContext.ip);
  const minuteBucketKey = buildTokenBucketKey('order/future/minute', requestContext.ip);
  scopeError(
    'ASTER_FUTURE_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: secondBucketKey, weight },
    () => tokenBucket(secondBucketKey, getTokenBucketOptions('order/future/second')).acquireSync(weight),
  );
  scopeError(
    'ASTER_FUTURE_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: minuteBucketKey, weight },
    () => tokenBucket(minuteBucketKey, getTokenBucketOptions('order/future/minute')).acquireSync(weight),
  );
  return request(credential, 'POST', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 查询当前挂单 (永续)
 *
 * Weight: with symbol 1, without symbol 40
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2728-L2766
 */
export const getFApiV1OpenOrders = async (
  credential: ICredential,
  params: {
    symbol?: string;
  },
): Promise<IAsterFutureOpenOrder[]> => {
  const endpoint = '/fapi/v1/openOrders';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = params?.symbol ? 1 : 40;
  const requestContext = await createRequestContext();
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: buildTokenBucketKey(url.host, requestContext.ip),
      weight,
      hasSymbol: !!params?.symbol,
    },
    () =>
      tokenBucket(
        buildTokenBucketKey(url.host, requestContext.ip),
        getTokenBucketOptions(url.host),
      ).acquireSync(weight),
  );
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 查询当前挂单 (现货)
 *
 * Weight: with symbol 1, without symbol 40
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1196-L1234
 */
export const getApiV1OpenOrders = async (
  credential: ICredential,
  params: {
    symbol?: string;
  },
): Promise<IAsterSpotOpenOrder[]> => {
  const endpoint = '/api/v1/openOrders';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = params?.symbol ? 1 : 40;
  const requestContext = await createRequestContext();
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: buildTokenBucketKey(url.host, requestContext.ip),
      weight,
      hasSymbol: !!params?.symbol,
    },
    () =>
      tokenBucket(
        buildTokenBucketKey(url.host, requestContext.ip),
        getTokenBucketOptions(url.host),
      ).acquireSync(weight),
  );
  return request(credential, 'GET', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2498-L2516
 */
export const deleteFApiV1Order = async (
  credential: ICredential,
  params: {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
): Promise<Record<string, never>> => {
  const endpoint = '/fapi/v1/order';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = await createRequestContext();
  const secondBucketKey = buildTokenBucketKey('order/future/second', requestContext.ip);
  const minuteBucketKey = buildTokenBucketKey('order/future/minute', requestContext.ip);
  scopeError(
    'ASTER_FUTURE_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: secondBucketKey, weight },
    () => tokenBucket(secondBucketKey, getTokenBucketOptions('order/future/second')).acquireSync(weight),
  );
  scopeError(
    'ASTER_FUTURE_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: minuteBucketKey, weight },
    () => tokenBucket(minuteBucketKey, getTokenBucketOptions('order/future/minute')).acquireSync(weight),
  );
  return request(credential, 'DELETE', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 获取账户信息 (现货)
 *
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
 */
export const getApiV1Account = async (
  credential: ICredential,
  params: Record<string, never>,
): Promise<{
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  canBurnAsset: boolean;
  updateTime: number;
  balances: {
    asset: string;
    free: string;
    locked: string;
  }[];
}> => {
  const endpoint = '/api/v1/account';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = 5;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * 获取最新价格
 *
 * Weight: without symbol 2 (current implementation)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getApiV1TickerPrice = async (
  credential: ICredential,
  params: Record<string, never>,
): Promise<
  {
    symbol: string;
    price: string;
    time: number;
  }[]
> => {
  const endpoint = '/api/v1/ticker/price';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = 2;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#post-apiv1order-%E7%9A%84%E7%A4%BA%E4%BE%8B
 */
export const postApiV1Order = async (
  credential: ICredential,
  params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
  },
): Promise<{
  orderId: number;
}> => {
  const endpoint = '/api/v1/order';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = await createRequestContext();
  const secondBucketKey = buildTokenBucketKey('order/spot/second', requestContext.ip);
  const minuteBucketKey = buildTokenBucketKey('order/spot/minute', requestContext.ip);
  scopeError(
    'ASTER_SPOT_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: secondBucketKey, weight },
    () => tokenBucket(secondBucketKey, getTokenBucketOptions('order/spot/second')).acquireSync(weight),
  );
  scopeError(
    'ASTER_SPOT_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: minuteBucketKey, weight },
    () => tokenBucket(minuteBucketKey, getTokenBucketOptions('order/spot/minute')).acquireSync(weight),
  );
  return request(credential, 'POST', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * 取消有效订单 (现货)
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1040-L1074
 */
export const deleteApiV1Order = async (
  credential: ICredential,
  params: {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
): Promise<Record<string, never>> => {
  const endpoint = '/api/v1/order';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = 1;
  const requestContext = await createRequestContext();
  const secondBucketKey = buildTokenBucketKey('order/spot/second', requestContext.ip);
  const minuteBucketKey = buildTokenBucketKey('order/spot/minute', requestContext.ip);
  scopeError(
    'ASTER_SPOT_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: secondBucketKey, weight },
    () => tokenBucket(secondBucketKey, getTokenBucketOptions('order/spot/second')).acquireSync(weight),
  );
  scopeError(
    'ASTER_SPOT_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: minuteBucketKey, weight },
    () => tokenBucket(minuteBucketKey, getTokenBucketOptions('order/spot/minute')).acquireSync(weight),
  );
  return request(credential, 'DELETE', SpotBaseURL, endpoint, params, requestContext);
};

/**
 * 获取账户损益资金流水(USER_DATA)
 *
 * 权重: 30
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E8%8E%B7%E5%8F%96%E8%B4%A6%E6%88%B7%E6%8D%9F%E7%9B%8A%E8%B5%84%E9%87%91%E6%B5%81%E6%B0%B4user_data
 */
export const getAccountIncome = async (
  credential: ICredential,
  params: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    recvWindow?: number;
    limit?: number;
    timestamp: number;
  },
): Promise<
  {
    symbol: string;
    incomeType: string;
    income: string;
    asset: string;
    info: string;
    time: number;
    tranId: string;
    tradeId: string;
  }[]
> => {
  const endpoint = '/fapi/v1/income';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 30;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};

/**
 * 账户成交历史 (USER_DATA)
 *
 * 权重: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E8%B4%A6%E6%88%B7%E6%88%90%E4%BA%A4%E5%8E%86%E5%8F%B2-user_data
 */
export const getAccountTradeList = async (
  credential: ICredential,
  params: {
    symbol: string;
    timestamp: number;
    fromId?: number;
    startTime?: number;
    endTime?: number;
    limit?: number;
    recvWindow?: number;
  },
): Promise<
  {
    symbol: string;
    id: number;
    orderId: number;
    side: string;
    price: string;
    qty: string;
    realizedPnl: string;
    quoteQty: string;
    commission: string;
    commissionAsset: string;
    time: number;
    buyer: boolean;
    maker: boolean;
    positionSide: string;
  }[]
> => {
  const endpoint = '/fapi/v1/userTrades';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = 5;
  const requestContext = await createRequestContext();
  acquireRateLimit('GET', url, endpoint, weight, requestContext);
  return request(credential, 'GET', FutureBaseURL, endpoint, params, requestContext);
};
