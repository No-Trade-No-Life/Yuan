import { opensslEquivalentHMAC } from './utils';

const API_KEY = process.env.API_KEY!;
const SECRET_KEY = process.env.SECRET_KEY!;

const BASE_URL = 'https://fapi.asterdex.com';

const request = async <T>(
  type: 'NONE' | 'TRADE' | 'USER_DATA' | 'USER_STREAM' | 'MARKET_DATA',
  method: string,
  endpoint: string,
  params: any = {},
): Promise<T> => {
  const needApiKey = type !== 'NONE';
  const needSign = type === 'TRADE' || type === 'USER_DATA';

  const url = new URL(BASE_URL);
  url.pathname = endpoint;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    url.searchParams.set(key, `${value}`);
  }

  if (needSign) {
    url.searchParams.set('timestamp', `${Date.now()}`);
    const msg = url.search.slice(1); // 去掉开头的 '?'
    const signature = await opensslEquivalentHMAC(msg, SECRET_KEY);
    url.searchParams.set('signature', signature);
  }

  console.info(url.toString());
  const res = await fetch(url.toString(), {
    method,
    headers: needApiKey
      ? {
          'X-MBX-APIKEY': API_KEY,
        }
      : {},
  }).then((response) => response.json());
  if (res.code && res.code !== 0) {
    throw JSON.stringify(res);
  }
  return res;
};

const createApi =
  <TReq, TRes>(
    type: 'NONE' | 'TRADE' | 'USER_DATA' | 'USER_STREAM' | 'MARKET_DATA',
    method: string,
    endpoint: string,
  ) =>
  (params: TReq) =>
    request<TRes>(type, method, endpoint, params);

/**
 * 获取账户信息
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AFv4-user_data
 */
export const getFApiV4Account = createApi<
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
>('USER_DATA', 'GET', '/fapi/v4/account');

export const getFApiV2Balance = createApi<
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
>('USER_DATA', 'GET', '/fapi/v2/balance');

export const postFApiV1Order = createApi<
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
>('TRADE', 'POST', '/fapi/v1/order');
