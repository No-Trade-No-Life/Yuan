import { opensslEquivalentHMAC } from './utils';

const API_KEY = process.env.API_KEY!;
const SECRET_KEY = process.env.SECRET_KEY!;

const BASE_URL = 'https://sapi.asterdex.com';

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

  const response = await fetch(url.toString(), {
    method,
    headers: needApiKey
      ? {
          'X-MBX-APIKEY': API_KEY,
        }
      : {},
  }).then((response) => response.json() as any);

  if (response.code && response.code !== 0) {
    throw JSON.stringify(response);
  }

  return response;
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
 * 获取账户信息 (现货)
 *
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
 */
export const getApiV1Account = createApi<
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
>('USER_DATA', 'GET', '/api/v1/account');

/**
 * 获取最新价格
 * https://github.com/asterdex/api-docs/blob/master/aster-finance-spot-api_CN.md#%E6%9C%80%E6%96%B0%E4%BB%B7%E6%A0%BC
 */
export const getApiV1TickerPrice = createApi<
  {},
  {
    symbol: string;
    price: string;
    time: number;
  }[]
>('MARKET_DATA', 'GET', '/api/v1/ticker/price');

export const postApiV1Order = createApi<
  {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
  },
  {}
>('TRADE', 'POST', '/api/v1/order');
