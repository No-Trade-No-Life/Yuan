import { HmacSHA256 } from '@yuants/utils';
import { uint8ArrayToHex } from '../utils';

export interface ICredential {
  address: string;
  api_key: string;
  secret_key: string;
}

export const getDefaultCredential = (): ICredential => {
  return {
    address: process.env.API_ADDRESS || '',
    api_key: process.env.API_KEY || '',
    secret_key: process.env.SECRET_KEY || '',
  };
};

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
  const signature = uint8ArrayToHex(
    await HmacSHA256(new TextEncoder().encode(msg), new TextEncoder().encode(credential.secret_key)),
  );
  url.searchParams.set('signature', signature);

  console.info(url.toString());
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'X-MBX-APIKEY': credential.api_key,
    },
  }).then((response) => response.json());
  if (res.code && res.code !== 0) {
    throw JSON.stringify(res);
  }
  return res;
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

export const getFApiV1OpenOrders = createFutureApi<
  {
    symbol?: string;
  },
  {
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
  }[]
>('GET', '/fapi/v1/openOrders');

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
