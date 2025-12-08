import { encodeHex, HmacSHA256, newError } from '@yuants/utils';

import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';

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
  params: any = {},
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

const createApi =
  (baseURL: string) =>
  <TReq, TRes>(method: string, endpoint: string) =>
  (credential: ICredential, params: TReq) =>
    request<TRes>(credential, method, baseURL, endpoint, params);

const createFutureApi = createApi('https://fapi.asterdex.com');
const createSpotApi = createApi('https://sapi.asterdex.com');

/**
 * 获取账户信息
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AFv4-user_data
 */
export const getFApiV4Account = createFutureApi<
  {},
  {
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
  }
>('GET', '/fapi/v4/account');

export const getFApiV2Balance = createFutureApi<
  {},
  {
    accountAlias: string; // 账户唯一识别码
    asset: string; // 资产
    balance: string; // 总余额
    crossWalletBalance: string; // 全仓余额
    crossUnPnl: string; // 全仓持仓未实现盈亏
    availableBalance: string; // 下单可用余额
    maxWithdrawAmount: string; // 最大可转出余额
    marginAvailable: boolean; // 是否可用作联合保证金
    updateTime: number;
  }[]
>('GET', '/fapi/v2/balance');

export const postFApiV1Order = createFutureApi<
  {
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
  {}
>('POST', '/fapi/v1/order');

/**
 * 查询当前挂单 (永续)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#L2728-L2766
 */
export const getFApiV1OpenOrders = createFutureApi<
  {
    symbol?: string;
  },
  IAsterFutureOpenOrder[]
>('GET', '/fapi/v1/openOrders');

/**
 * 查询当前挂单 (现货)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1196-L1234
 */
export const getApiV1OpenOrders = createSpotApi<
  {
    symbol?: string;
  },
  IAsterSpotOpenOrder[]
>('GET', '/api/v1/openOrders');

export const deleteFApiV1Order = createFutureApi<
  {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
  {}
>('DELETE', '/fapi/v1/order');

/**
 * 获取账户信息 (现货)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
 */
export const getApiV1Account = createSpotApi<
  {},
  {
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
  }
>('GET', '/api/v1/account');

/**
 * 获取最新价格
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getApiV1TickerPrice = createSpotApi<
  {},
  {
    symbol: string;
    price: string;
    time: number;
  }[]
>('GET', '/api/v1/ticker/price');

export const postApiV1Order = createSpotApi<
  {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
  },
  {
    orderId: number; // 系统的订单ID
  }
>('POST', '/api/v1/order');

/**
 * 取消有效订单 (现货)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#L1040-L1074
 */
export const deleteApiV1Order = createSpotApi<
  {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
  {}
>('DELETE', '/api/v1/order');
