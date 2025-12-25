import { encodeHex, HmacSHA256, newError, scopeError, tokenBucket } from '@yuants/utils';

import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';

import './client';

const MetricsAsterApiCallCounter = GlobalPrometheusRegistry.counter(
  'aster_api_call',
  'Number of aster api call',
);
const terminal = Terminal.fromNodeEnv();

export interface ICredential {
  address: string;
  api_key: string;
  secret_key: string;
}

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

  console.info(url.toString());
  MetricsAsterApiCallCounter.labels({ path: url.pathname, terminal_id: terminal.terminal_id }).inc();
  const response = await fetch(url.toString(), {
    method,
    headers: {
      'X-MBX-APIKEY': credential.api_key,
    },
  });

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
export const getFApiV4Account = (
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
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', FutureBaseURL, endpoint, params);
};

/**
 * 用户持仓风险V2 (USER_DATA)
 *
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E7%94%A8%E6%88%B7%E6%8C%81%E4%BB%93%E9%A3%8E%E9%99%A9v2-user_data
 */
export const getFApiV2PositionRisk = (
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
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', FutureBaseURL, endpoint, params);
};

/**
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2840-L2855
 */
export const getFApiV2Balance = (
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
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', FutureBaseURL, endpoint, params);
};

/**
 * Weight: 1 by order
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#post-fapiv1order-%E7%9A%84%E7%A4%BA%E4%BE%8B
 */
export const postFApiV1Order = (
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
  scopeError(
    'ASTER_FUTURE_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/future/second').acquireSync(weight),
  );
  scopeError(
    'ASTER_FUTURE_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/future/minute').acquireSync(weight),
  );
  return request(credential, 'POST', FutureBaseURL, endpoint, params);
};

/**
 * 查询当前挂单 (永续)
 *
 * Weight: with symbol 1, without symbol 40
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2728-L2766
 */
export const getFApiV1OpenOrders = (
  credential: ICredential,
  params: {
    symbol?: string;
  },
): Promise<IAsterFutureOpenOrder[]> => {
  const endpoint = '/fapi/v1/openOrders';
  const url = new URL(FutureBaseURL);
  url.pathname = endpoint;
  const weight = params?.symbol ? 1 : 40;
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: url.host,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', FutureBaseURL, endpoint, params);
};

/**
 * 查询当前挂单 (现货)
 *
 * Weight: with symbol 1, without symbol 40
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1196-L1234
 */
export const getApiV1OpenOrders = (
  credential: ICredential,
  params: {
    symbol?: string;
  },
): Promise<IAsterSpotOpenOrder[]> => {
  const endpoint = '/api/v1/openOrders';
  const url = new URL(SpotBaseURL);
  url.pathname = endpoint;
  const weight = params?.symbol ? 1 : 40;
  scopeError(
    'ASTER_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: url.host,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', SpotBaseURL, endpoint, params);
};

/**
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2498-L2516
 */
export const deleteFApiV1Order = (
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
  scopeError(
    'ASTER_FUTURE_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/future/second').acquireSync(weight),
  );
  scopeError(
    'ASTER_FUTURE_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/future/minute').acquireSync(weight),
  );
  return request(credential, 'DELETE', FutureBaseURL, endpoint, params);
};

/**
 * 获取账户信息 (现货)
 *
 * Weight: 5
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
 */
export const getApiV1Account = (
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
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', SpotBaseURL, endpoint, params);
};

/**
 * 获取最新价格
 *
 * Weight: without symbol 2 (current implementation)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getApiV1TickerPrice = (
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
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request(credential, 'GET', SpotBaseURL, endpoint, params);
};

/**
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#post-apiv1order-%E7%9A%84%E7%A4%BA%E4%BE%8B
 */
export const postApiV1Order = (
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
  scopeError(
    'ASTER_SPOT_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/spot/second').acquireSync(weight),
  );
  scopeError(
    'ASTER_SPOT_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/spot/minute').acquireSync(weight),
  );
  return request(credential, 'POST', SpotBaseURL, endpoint, params);
};

/**
 * 取消有效订单 (现货)
 *
 * Weight: 1
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1040-L1074
 */
export const deleteApiV1Order = (
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
  scopeError(
    'ASTER_SPOT_ORDER_API_SECOND_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/spot/second').acquireSync(weight),
  );
  scopeError(
    'ASTER_SPOT_ORDER_API_MINUTE_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket('order/spot/minute').acquireSync(weight),
  );
  return request(credential, 'DELETE', SpotBaseURL, endpoint, params);
};
