import { fetch } from '@yuants/http-services';
import { encodeBase64, formatTime, HmacSHA256, scopeError, tokenBucket } from '@yuants/utils';

const SPOT_API_ROOT = 'api.huobi.pro';
const LINEAR_SWAP_API_ROOT = 'api.hbdm.com';

export interface ICredential {
  access_key: string;
  secret_key: string;
}

const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

export const getDefaultCredential = (): ICredential => {
  return {
    access_key: process.env.ACCESS_KEY!,
    secret_key: process.env.SECRET_KEY!,
  };
};

// https://www.htx.com/zh-cn/opend/newApiPages/?id=474
type HuobiBusiness = 'spot' | 'linear-swap';
type HuobiPrivateInterfaceType = 'trade' | 'query';

const acquirePrivate = (bucketId: string, meta: Record<string, unknown>) => {
  scopeError('HUOBI_API_RATE_LIMIT', { ...meta, bucketId }, () =>
    tokenBucket(bucketId, { capacity: 36, refillAmount: 36, refillInterval: 3000 }).acquireSync(1),
  );
};

const privateRequestWithRateLimit = async (
  credential: ICredential,
  interfaceType: HuobiPrivateInterfaceType,
  business: HuobiBusiness,
  method: string,
  path: string,
  api_root: string,
  params?: any,
) => {
  const meta = { method, api_root, path, business, interfaceType };

  const interfaceTypeUpper = interfaceType.toUpperCase();
  const businessUpper = business.toUpperCase();
  const globalBucketId = `HUOBI_PRIVATE_${interfaceTypeUpper}_UID_3S_ALL:${credential.access_key}`;
  const businessBucketId = `HUOBI_PRIVATE_${interfaceTypeUpper}_UID_3S_${businessUpper}:${credential.access_key}`;
  acquirePrivate(globalBucketId, meta);
  acquirePrivate(businessBucketId, meta);

  const requestParams = `AccessKeyId=${
    credential.access_key
  }&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=${encodeURIComponent(
    new Date().toISOString().split('.')[0],
  )}${
    method === 'GET' && params !== undefined
      ? `&${Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')}`
      : ''
  }`;

  const body = method === 'GET' ? '' : JSON.stringify(params);

  const requestString = `${method}\n${api_root}\n${path}\n${requestParams}`;

  const str = encodeBase64(
    await HmacSHA256(
      new TextEncoder().encode(requestString),
      new TextEncoder().encode(credential.secret_key),
    ),
  );

  const url = new URL(`https://${api_root}${path}?${requestParams}&Signature=${encodeURIComponent(str)}`);
  // url.searchParams.sort();
  console.info(formatTime(Date.now()), 'PrivateApiRequest', method, url.host, url.pathname);
  const res = await fetchImpl(url.href, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body || undefined,
  });

  const retStr = await res.text();
  console.info(formatTime(Date.now()), 'PrivateResponse', url.host, url.pathname, res.status);
  try {
    return JSON.parse(retStr);
  } catch (e) {
    console.error(formatTime(Date.now()), 'huobiRequestFailed', path, JSON.stringify(params), retStr);
    throw e;
  }
};

const spotPrivateQueryRequest = (credential: ICredential, method: string, path: string, params?: any) =>
  privateRequestWithRateLimit(credential, 'query', 'spot', method, path, SPOT_API_ROOT, params);

const spotPrivateTradeRequest = (credential: ICredential, method: string, path: string, params?: any) =>
  privateRequestWithRateLimit(credential, 'trade', 'spot', method, path, SPOT_API_ROOT, params);

const linearSwapPrivateQueryRequest = (credential: ICredential, method: string, path: string, params?: any) =>
  privateRequestWithRateLimit(credential, 'query', 'linear-swap', method, path, LINEAR_SWAP_API_ROOT, params);

const linearSwapPrivateTradeRequest = (credential: ICredential, method: string, path: string, params?: any) =>
  privateRequestWithRateLimit(credential, 'trade', 'linear-swap', method, path, LINEAR_SWAP_API_ROOT, params);

/**
 * 获取账户信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec40743-7773-11ed-9966-0242ac110003
 */
export const getAccount = (
  credential: ICredential,
): Promise<{
  status: string;
  data: {
    id: number;
    type: string;
    state: string;
    subtype: string;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', '/v1/account/accounts');
};

/**
 * 获取用户ID
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec491c9-7773-11ed-9966-0242ac110003
 */
export const getUid = (credential: ICredential): Promise<{ data: number; code: number }> => {
  return spotPrivateQueryRequest(credential, 'GET', '/v2/user/uid');
};

/**
 * 获取统一账户信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=10000073-77b7-11ed-9966-0242ac110003
 */
export const getUnifiedAccountInfo = (
  credential: ICredential,
): Promise<{
  status: string;
  code: number;
  msg: string;
  data: {
    margin_asset: string;
    margin_balance: number;
    margin_static: number;
    cross_margin_static: number;
    cross_profit_unreal: number;
    withdraw_available: number;
  }[];
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/linear-swap-api/v3/unified_account_info');
};

/**
 * 获取合约持仓信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb74963-77b5-11ed-9966-0242ac110003
 */
export const getSwapCrossPositionInfo = (
  credential: ICredential,
  params?: {
    contract_code?: string;
    pair?: string;
    contract_type: string;
  },
): Promise<{
  status: string;
  ts: number;
  data: {
    symbol: string;
    contract_code: string;
    volume: number;
    available: number;
    frozen: number;
    cost_open: number;
    cost_hold: number;
    profit_unreal: number;
    profit_rate: number;
    lever_rate: number;
    position_margin: number;
    direction: string;
    profit: number;
    last_price: number;
    margin_asset: string;
    margin_mode: string;
    margin_account: string;
    contract_type: string;
    pair: string;
    business_type: string;
    position_mode: string;
    adl_risk_percent: string;
    liquidation_price?: number;
  }[];
}> => {
  return linearSwapPrivateQueryRequest(
    credential,
    'POST',
    '/linear-swap-api/v1/swap_cross_position_info',
    params,
  );
};

/**
 * 获取合约挂单
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb784d4-77b5-11ed-9966-0242ac110003
 */
export const getSwapOpenOrders = (
  credential: ICredential,
  params?: {
    contract_code?: string;
    pair?: string;
    page_index?: number;
    page_size?: number;
    sort_by?: string;
    trade_type?: string;
  },
): Promise<{
  status: string;
  data: {
    orders: {
      order_id_str: string;
      contract_code: string;
      order_price_type: string;
      direction: string;
      offset: string;
      volume: number;
      created_at: number;
      price: number;
      trade_volume: number;
    }[];
  };
}> => {
  return linearSwapPrivateQueryRequest(
    credential,
    'POST',
    '/linear-swap-api/v1/swap_cross_openorders',
    params,
  );
};

/**
 * 获取现货账户余额
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec40922-7773-11ed-9966-0242ac110003
 */
export const getSpotAccountBalance = (
  credential: ICredential,
  account_uid: number,
): Promise<{
  status: string;
  data: {
    list: {
      currency: string;
      balance: string;
      type: string;
    }[];
  };
}> => {
  return spotPrivateQueryRequest(credential, 'GET', `/v1/account/accounts/${account_uid}/balance`);
};

/**
 * 获取杠杆借贷信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41863-7773-11ed-9966-0242ac110003
 */
export const getCrossMarginLoanInfo = (
  credential: ICredential,
): Promise<{
  status: string;
  code: number;
  data: {
    currency: string;
    'loanable-amt': string;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', '/v1/cross-margin/loan-info');
};

/**
 * 现货下单
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=10000065-77b7-11ed-9966-0242ac110003
 */
export const postSpotOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    'account-id': string;
    amount: string;
    market_amount?: string;
    'borrow-amount'?: string;
    type: string;
    'trade-purpose': string;
    price?: string;
    source: string;
    'client-order-id'?: string;
  },
): Promise<{ success: boolean; code: number; message: string; data: { orderId: number } }> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v1/order/auto/place`, params);
};

/**
 * 合约下单
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb77159-77b5-11ed-9966-0242ac110003
 */
export const postSwapOrder = (
  credential: ICredential,
  params: {
    contract_code: string;
    contract_type: string;
    price?: number;
    volume: number;
    offset: string;
    direction: string;
    lever_rate: number;
    order_price_type: string;
    channel_code?: string;
  },
): Promise<{ status: string; ts: number; data: { order_id: number; order_id_str: string } }> => {
  return linearSwapPrivateTradeRequest(credential, 'POST', '/linear-swap-api/v1/swap_cross_order', params);
};

/**
 * 联合保证金模式合约下单
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-1957dd521e6
 */
export const postUnionAccountSwapOrder = (
  credential: ICredential,
  params: {
    time_in_force?: string;
    price_protect?: string;
    contract_code: string;
    margin_mode: string;
    position_side: string;
    price?: number;
    volume: number;
    side: string;
    type: string;
    tp_trigger_price?: string;
    tp_order_price?: string;
    tp_trigger_price_type?: string;
    tp_type?: string;
    sl_trigger_price?: string;
    sl_order_price?: string;
    sl_trigger_price_type?: string;
    sl_type?: string;
  },
): Promise<{ code: number; message: string; data: { order_id: number; order_id_str: string } }> => {
  return linearSwapPrivateTradeRequest(credential, 'POST', '/v5/trade/order', params);
};

/**
 * 获取现货存款地址
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec45fb7-7773-11ed-9966-0242ac110003
 */
export const getSpotAccountDepositAddresses = (
  credential: ICredential,
  params: { currency: string },
): Promise<{
  code: number;
  message: string;
  data: {
    currency: string;
    chain: string;
    address: string;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', `/v2/account/deposit/address`, params);
};

/**
 * 获取账户流水
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec4610b-7773-11ed-9966-0242ac110003
 */
export const getAccountLedger = (
  credential: ICredential,
  params: { accountId: string; currency: string },
): Promise<{
  status: string;
  data: {
    transactTime: number;
    transactAmt: number;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', `/v2/account/ledger`, params);
};

/**
 * 超级杠杆转出
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41ff0-7773-11ed-9966-0242ac110003
 */
export const postSuperMarginAccountTransferOut = (
  credential: ICredential,
  params: {
    currency: string;
    amount: string;
  },
): Promise<{ status: string; data: number }> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v1/cross-margin/transfer-out`, params);
};

/**
 * 超级杠杆转入
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41f0e-7773-11ed-9966-0242ac110003
 */
export const postSuperMarginAccountTransferIn = (
  credential: ICredential,
  params: {
    currency: string;
    amount: string;
  },
): Promise<{ status: string; data: number }> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v1/cross-margin/transfer-in`, params);
};

/**
 * 现货账户转账
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=10000095-77b7-11ed-9966-0242ac110003
 */
export const postSpotAccountTransfer = (
  credential: ICredential,
  params: {
    from: string;
    to: string;
    currency: string;
    amount: number;
    'margin-account': string;
  },
): Promise<{ success: boolean; data: number; code: number; message: string }> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v2/account/transfer`, params);
};

/**
 * 借贷
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41b5d-7773-11ed-9966-0242ac110003
 */
export const postBorrow = (
  credential: ICredential,
  params: { currency: string; amount: string },
): Promise<{
  status: string;
  data: number;
}> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v1/cross-margin/orders`, params);
};

/**
 * 提现
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec42cfd-7773-11ed-9966-0242ac110003
 */
export const postWithdraw = (
  credential: ICredential,
  params: {
    address: string;
    amount: string;
    currency: string;
    fee: string;
    chain: string;
  },
): Promise<{
  status: string;
  data: number;
}> => {
  return spotPrivateTradeRequest(credential, 'POST', `/v1/dw/withdraw/api/create`, params);
};

/**
 * 获取充提历史
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec44f99-7773-11ed-9966-0242ac110003
 */
export const getDepositWithdrawHistory = (
  credential: ICredential,
  params: {
    currency: string;
    type: string;
    from?: string;
    size?: string;
    direct?: string;
  },
): Promise<{
  status: string;
  'error-code': string;
  'error-msg': string;
  data: {
    id: number;
    type: string;
    currency: string;
    'tx-hash': string;
    chain: string;
    amount: string;
    address: string;
    'address-tag': string;
    fee: string;
    state: string;
    'create-at': number;
    'update-at': number;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', `/v1/query/deposit-withdraw`, params);
};

/**
 * 资产划转（母子用户之间）
 *
 * 接口权限: 交易
 *
 * 限频: 2次/2s
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec45d8e-7773-11ed-9966-0242ac110003
 */
export const postSubUserTransfer = (
  credential: ICredential,
  params: {
    'sub-uid': number;
    currency: string;
    amount: number;
    'client-order-id'?: string;
    type: string;
  },
): Promise<{
  data: number;
  status: string;
}> => {
  return spotPrivateTradeRequest(credential, 'POST', '/v1/subuser/transfer', params);
};

/**
 * 获取子用户列表
 *
 * 接口权限: 读取
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec48f09-7773-11ed-9966-0242ac110003
 */
export const getSubUserList = (
  credential: ICredential,
  params?: { fromId?: number },
): Promise<{
  code: number;
  message?: string;
  data: {
    uid: number;
    userState: string;
    subUserName: string;
    note: string;
  }[];
  nextId?: number;
  ok: boolean;
}> => {
  return spotPrivateQueryRequest(credential, 'GET', `/v2/sub-user/user-list`, params);
};

/**
 * 账户类型查询
 *
 * 是否验签: 是
 *
 * 接口权限: 读取
 *
 * 限频: 每个UID 3秒最多 144 次请求(交易接口3秒最多 72 次请求，查询接口3秒最多 72 次请求) (该UID的所有币种和不同到期日的合约的所有私有接口共享该限制) 。
 *
 * 接口描述: 此接口用于客户查询的账号类型，当前U本位合约有统一账户和非统一账户（全仓逐仓账户）类型。统一账户类型资产放在USDT一个账户上，全仓逐仓账户类型资产放在不同的币对。
 * 统一账户类型为最新升级的，当前不支持API下单。若需要用用API下单请切换账户类型为非统一账户。
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb71825-77b5-11ed-9966-0242ac110003
 */
export const getSwapUnifiedAccountType = (
  credential: ICredential,
): Promise<{
  code: number;
  msg: string;
  ts: number;
  data: {
    account_type: number;
  };
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/linear-swap-api/v3/swap_unified_account_type');
};

/**
 * 账户类型更改接口
 *
 * 是否验签: 是
 *
 * 接口权限: 交易
 *
 * 限频: 每个UID 3秒最多 144 次请求(交易接口3秒最多 72 次请求，查询接口3秒最多 72 次请求) (该UID的所有币种和不同到期日的合约的所有私有接口共享该限制) 。
 *
 * 接口描述: 调用该接口前需要保证U本位合约无持仓和挂单，当由非统一账户（全仓逐仓账户）变为统一账户还需将资产从逐仓账户划转到全仓账户。
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb7196b-77b5-11ed-9966-0242ac110003
 */
export const postSwapSwitchAccountType = (
  credential: ICredential,
  params: { account_type: number },
): Promise<{
  code: number;
  msg: string;
  ts: number;
  data: {
    account_type: number;
  };
}> => {
  return linearSwapPrivateTradeRequest(
    credential,
    'POST',
    '/linear-swap-api/v3/swap_switch_account_type',
    params,
  );
};

/**
 * APIv2币链参考信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec478f0-7773-11ed-9966-0242ac110003
 */
export const getV2ReferenceCurrencies = (
  credential: ICredential,
  params: {
    currency?: string;
    authorizedUser?: string;
  },
): Promise<{
  code: number;
  data: {
    currency: string;
    assetType: number;
    chains: {
      chain: string;
      displayName: string;
      fullName: string;
      baseChain?: string;
      baseChainProtocol?: string;
      isDynamic?: boolean;
      numOfConfirmations: number;
      numOfFastConfirmations: number;
      depositStatus: string;
      minDepositAmt: string;
      withdrawStatus: string;
      minWithdrawAmt: string;
      withdrawPrecision: number;
      maxWithdrawAmt: string;
      withdrawQuotaPerDay: string;
      withdrawQuotaPerYear: null;
      withdrawQuotaTotal: null;
      withdrawFeeType: string;
      transactFeeWithdraw?: string;
      addrWithTag: boolean;
      addrDepositTag: boolean;
      minTransactFeeWithdraw?: string;
      transactFeeRateWithdraw?: string;
      maxTransactFeeWithdraw?: string;
    }[];
    instStatus: string;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', '/v2/reference/currencies', params);
};

/**
 * 获取账户历史
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41049-7773-11ed-9966-0242ac110003
 */
export const getAccountHistory = (
  credential: ICredential,
  params: {
    'account-id': string;
    currency?: string;
    'transact-types'?: number;
    'start-time'?: number;
    'end-time'?: number;
    sort?: 'asc' | 'desc';
    size?: number;
    'from-id'?: number;
  },
): Promise<{
  // code: number;
  'transact-amt': string;
  'avail-balance': string;
  'acct-balance': string;
  'transact-time': string;
  'record-id': string;
  status: string;
  data: {
    'account-id': string;
    currency: string;
    'record-id': string;
    'transact-amt': string;
    'transact-type': string;
    'avail-balance': string;
    'acct-balance': string;
    'transact-time': string;
  }[];
}> => {
  return spotPrivateQueryRequest(credential, 'GET', '/v1/account/history', params);
};

/**
 * 查询资产模式
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-1957dd37de0
 */
export const getAccountAssetsMode = (
  credential: ICredential,
): Promise<{
  code: number;
  msg: string;
  data: {
    asset_mode: number;
  };
  ts: number;
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/v5/account/asset_mode');
};

/**
 * 查询联合保证金账户余额
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-195703a12d5
 */
export const getUnionAccountBalance = (
  credential: ICredential,
): Promise<{
  code: number;
  message: string;
  data: {
    available_margin: string;
    created_time: number;
    details: {
      available: string;
      created_time: number;
      currency: string;
      equity: string;
      initial_margin: string;
      initial_margin_rate: string;
      maintenance_margin: string;
      maintenance_margin_rate: string;
      profit_unreal: string;
      voucher: string;
      voucher_value: string;
      withdraw_available: string;
      updated_time: number;
    }[];
    equity: string;
    initial_margin: string;
    maintenance_margin: string;
    maintenance_margin_rate: string;
    profit_unreal: string;
    state: string;
    voucher_value: string;
    updated_time: number;
  };
  ts: number;
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/v5/account/balance');
};

/**
 * 查询联合保证金账户持仓
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-1957f1fbee4
 */
export const getUnionAccountPositions = (
  credential: ICredential,
): Promise<{
  code: number;
  message: string;
  data: {
    contract_code: string;
    position_side: string;
    direction: string;
    margin_mode: string;
    open_avg_price: string;
    volume: string;
    available: string;
    lever_rate: number;
    adl_risk_percent: null;
    liquidation_price: string;
    initial_margin: string;
    maintenance_margin: string;
    profit_unreal: string;
    profit_rate: string;
    margin_rate: string;
    mark_price: string;
    margin_currency: string;
    contract_type: string;
    created_time: number;
    updated_time: number;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/v5/trade/position/opens');
};

/**
 * 组合查询用户财务记录 (新))
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb75a91-77b5-11ed-9966-0242ac110003
 */
export const getAccountFinancialRecordExact = (
  credential: ICredential,
  params: {
    mar_acct: string;
    contract?: string;
    type?: string;
    start_time?: number;
    end_time?: number;
    direct?: string;
    from_id?: number;
  },
): Promise<{
  code: number;
  msg: string;
  data: {
    query_id: number;
    id: number;
    type: number;
    amount: number;
    ts: number;
    contract_code: string;
    asset: string;
    margin_account: string;
    face_margin_account: string;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateTradeRequest(
    credential,
    'POST',
    '/linear-swap-api/v3/swap_financial_record_exact',
    params,
  );
};

/**
 * (【全仓】获取历史成交记录(新))
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb78c48-77b5-11ed-9966-0242ac110003
 */
export const getAccountCrossMatchResults = (
  credential: ICredential,
  params: {
    contract: string;
    trade_type: number;
    pair?: string;
    start_time?: number;
    end_time?: number;
    direct?: string;
    from_id?: number;
  },
): Promise<{
  code: number;
  msg: string;
  data: {
    query_id: number;
    contract_type: string;
    pair: string;
    business_type: string;
    match_id: number;
    order_id: number;
    symbol: string;
    contract_code: string;
    direction: string;
    offset: string;
    trade_volume: number;
    trade_price: number;
    trade_turnover: number;
    trade_fee: number;
    offset_profitloss: number;
    create_date: number;
    role: string;
    order_source: string;
    order_id_str: string;
    id: string;
    fee_asset: string;
    margin_mode: string;
    margin_account: string;
    real_profit: number;
    reduce_only: number;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateTradeRequest(
    credential,
    'POST',
    '/linear-swap-api/v3/swap_cross_matchresults',
    params,
  );
};

/**
 * (【全仓】组合查询用户历史成交记录(新))
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb78ee2-77b5-11ed-9966-0242ac110003
 */
export const getAccountCrossMatchResultsExact = (
  credential: ICredential,
  params: {
    contract: string;
    trade_type: number;
    pair?: string;
    start_time?: number;
    end_time?: number;
    direct?: string;
    from_id?: number;
  },
): Promise<{
  code: number;
  msg: string;
  data: {
    query_id: number;
    contract_type: string;
    pair: string;
    business_type: string;
    match_id: number;
    order_id: number;
    symbol: string;
    contract_code: string;
    direction: string;
    offset: string;
    trade_volume: number;
    trade_price: number;
    trade_turnover: number;
    trade_fee: number;
    offset_profitloss: number;
    create_date: number;
    role: string;
    order_source: string;
    order_id_str: string;
    id: string;
    fee_asset: string;
    ht_price: string;
    margin_mode: string;
    margin_account: string;
    real_profit: number;
    reduce_only: number;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateTradeRequest(
    credential,
    'POST',
    '/linear-swap-api/v3/swap_cross_matchresults_exact',
    params,
  );
};

/**
 * (查询成交明细（近三天）)
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-1957e2a0e6a
 *
 *
 */
export const getAccountTradeOrderDetail = (
  credential: ICredential,
  params: {
    contract_code?: string;
    order_id?: number;
    start_time?: number;
    end_time?: number;
    direct?: string;
    from?: number;
    limit?: number;
  },
): Promise<{
  code: number;
  message: string;
  data: {
    id: string;
    contract_code: string;
    order_id: string;
    trade_id: string;
    side: string;
    position_side: string;
    order_type: string;
    margin_mode: string;
    type: string;
    role: string;
    trade_price: string;
    trade_volume: string;
    trade_turnover: string;
    created_time: number;
    updated_time: number;
    order_source: string;
    fee_currency: string;
    trade_fee: string;
    deduction_price: string;
    profit: string;
    contract_type: string;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/v5/trade/order/details', params);
};

/**
 * (查询流水记录)
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb89359-77b5-11ed-9966-19b724157a2
 *
 *
 */
export const getAccountBills = (
  credential: ICredential,
  params: {
    contract_code?: string;
    margin_mode?: string;
    type?: string;
    start_time?: number;
    end_time?: number;
    direct?: string;
    from?: number;
    limit?: number;
  },
): Promise<{
  code: number;
  message: string;
  data: {
    id: string;
    type: string;
    currency: string;
    amount: string;
    contract_code: string;
    margin_mode: string;
    created_time: string;
  }[];
  ts: number;
}> => {
  return linearSwapPrivateQueryRequest(credential, 'GET', '/v5/account/bills', params);
};
