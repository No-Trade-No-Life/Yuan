import { scopeError, tokenBucket } from '@yuants/utils';

import {
  buildTokenBucketKey,
  createRequestContext,
  getDefaultCredential,
  getTokenBucketOptions,
  IApiError,
  ICredential,
  requestPrivate,
} from './client';
export type { ICredential };

export interface IUnifiedAccountInfo {
  uniMMR: string;
  accountEquity: string;
  actualEquity: string;
  accountInitialMargin: string;
  accountMaintMargin: string;
  accountStatus: string;
  virtualMaxWithdrawAmount: string;
  totalAvailableBalance: string;
  totalMarginOpenLoss: string;
  updateTime: number;
}

export interface IUnifiedUmAsset {
  asset: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  updateTime: number;
}

export interface IUnifiedUmPosition {
  symbol: string;
  initialMargin: string;
  maintMargin: string;
  unrealizedProfit: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
  leverage: string;
  entryPrice: string;
  maxNotional: string;
  bidNotional: string;
  askNotional: string;
  positionSide: string;
  positionAmt: string;
  updateTime: number;
}

export interface IUnifiedUmAccount {
  assets: IUnifiedUmAsset[];
  positions: IUnifiedUmPosition[];
}

export interface IUnifiedUmOpenOrder {
  avgPrice: string;
  clientOrderId: string;
  cumQuote: string;
  executedQty: string;
  orderId: number;
  origQty: string;
  origType: string;
  price: string;
  reduceOnly: boolean;
  side: string;
  positionSide: string;
  status: string;
  symbol: string;
  time: number;
  timeInForce: string;
  type: string;
  updateTime: number;
  selfTradePreventionMode: string;
  goodTillDate: number;
}

export interface IUnifiedAccountBalanceEntry {
  asset: string;
  totalWalletBalance: string;
  crossMarginAsset: string;
  crossMarginBorrowed: string;
  crossMarginFree: string;
  crossMarginInterest: string;
  crossMarginLocked: string;
  umWalletBalance: string;
  umUnrealizedPNL: string;
  cmWalletBalance: string;
  cmUnrealizedPNL: string;
  updateTime: number;
}

export interface ISpotAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  commissionRates: {
    maker: string;
    taker: string;
    buyer: string;
    seller: string;
  };
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokered: boolean;
  requireSelfTradePrevention: boolean;
  preventSor: boolean;
  updateTime: number;
  balances: {
    asset: string;
    free: string;
    locked: string;
  }[];
  permissions: string[];
  uid: number;
}

export interface ISpotOrder {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  origQuoteOrderQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
}

export interface ISpotNewOrderResponse {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime: number;
}

export interface IAssetTransferResponse {
  tranId: number;
}

export interface IDepositAddress {
  address: string;
  coin: string;
  tag: string;
  url: string;
}

export interface ISubAccountSummary {
  email: string;
  isFreeze: boolean;
  createTime: number;
  isManagedSubAccount: boolean;
  isAssetManagementSubAccount: boolean;
}

export interface ISubAccountListResponse {
  subAccounts: ISubAccountSummary[];
}

export interface IWithdrawRecord {
  id: string;
  amount: string;
  transactionFee: string;
  coin: string;
  status: number;
  address: string;
  txId: string;
  applyTime: Date;
  network: string;
  transferType: number;
  info: string;
  confirmNo: number;
  walletType: number;
  txKey: string;
  completeTime: Date;
}

export interface IDepositRecord {
  id: string;
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  addressTag: string;
  txId: string;
  insertTime: number;
  transferType: number;
  confirmTimes: string;
  unlockConfirm: number;
  walletType: number;
}

export interface IUnifiedUmOrderResponse {
  clientOrderId: string;
  cumQty: string;
  cumQuote: string;
  executedQty: string;
  orderId: number;
  avgPrice: string;
  origQty: string;
  price: string;
  reduceOnly: boolean;
  side: string;
  positionSide: string;
  status: string;
  symbol: string;
  timeInForce: string;
  type: string;
  selfTradePreventionMode: string;
  goodTillDate: number;
  updateTime: number;
}

export interface IUMIncomeRecord {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}

export interface IAccountIncomeRecord {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}

/**
 * 查询账户信息(USER_DATA)
 *
 * 查询账户信息
 *
 * 权重: 20
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Account-Information
 */
export const getUnifiedAccountInfo = (credential: ICredential): Promise<IUnifiedAccountInfo | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/account';
  const url = new URL(endpoint);
  const weight = 20;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions('order/unified/minute')).acquireSync(weight),
  );
  return requestPrivate<IUnifiedAccountInfo | IApiError>(
    credential,
    'GET',
    endpoint,
    undefined,
    requestContext,
  );
};

/**
 * 获取UM账户信息
 *
 * 现有UM账户资产和仓位信息
 *
 * 权重: 5
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Get-UM-Account-Detail
 */
export const getUnifiedUmAccount = (credential: ICredential): Promise<IUnifiedUmAccount | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/account';
  const url = new URL(endpoint);
  const weight = 5;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions('order/unified/minute')).acquireSync(weight),
  );
  return requestPrivate<IUnifiedUmAccount | IApiError>(
    credential,
    'GET',
    endpoint,
    undefined,
    requestContext,
  );
};

/**
 * 查看当前全部UM挂单(USER_DATA)
 *
 * 查看当前全部UM挂单，请小心使用不带symbol参数的调用
 *
 * 权重: 带symbol 1 - 不带 40
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/trade/Query-All-Current-UM-Open-Orders
 */
export const getUnifiedUmOpenOrders = (
  credential: ICredential,
  params?: {
    symbol?: string;
  },
): Promise<IUnifiedUmOpenOrder[]> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/openOrders';
  const url = new URL(endpoint);
  const weight = params?.symbol ? 1 : 40;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: bucketKey,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUnifiedUmOpenOrder[]>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * 查询账户余额(USER_DATA)
 *
 * 查询账户余额
 *
 * 权重: 20
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Account-Balance
 */
export const getUnifiedAccountBalance = (
  credential: ICredential,
  params?: {
    assets?: string;
  },
): Promise<IUnifiedAccountBalanceEntry[] | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/balance';
  const url = new URL(endpoint);
  const weight = 20;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUnifiedAccountBalanceEntry[] | IApiError>(
    credential,
    'GET',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * 账户信息 (USER_DATA)
 *
 * 权重: 20
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
 */
export const getSpotAccountInfo = (
  credential: ICredential,
  params?: {
    omitZeroBalances?: boolean;
  },
): Promise<ISpotAccountInfo | IApiError> => {
  const endpoint = 'https://api.binance.com/api/v3/account';
  const url = new URL(endpoint);
  const weight = 20;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISpotAccountInfo | IApiError>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * Current open orders (USER_DATA)
 *
 * 权重: 带symbol: 6 不带: 80
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/account-endpoints#%E6%9F%A5%E7%9C%8B%E8%B4%A6%E6%88%B7%E5%BD%93%E5%89%8D%E6%8C%82%E5%8D%95-user_data
 */
export const getSpotOpenOrders = (
  credential: ICredential,
  params?: {
    symbol?: string;
  },
): Promise<ISpotOrder[] | IApiError> => {
  const endpoint = 'https://api.binance.com/api/v3/openOrders';
  const url = new URL(endpoint);
  const weight = params?.symbol ? 6 : 80;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      endpoint,
      host: url.host,
      path: url.pathname,
      bucketId: bucketKey,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISpotOrder[] | IApiError>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * New order (TRADE)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/trading-endpoints#%E4%B8%8B%E5%8D%95-trade
 */
export const postSpotOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    side: string;
    type: string;
    timeInForce?: string;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    newClientOrderId?: string;
    strategyId?: number;
    strategyType?: number;
    stopPrice?: number;
    trailingDelta?: number;
    icebergQty?: number;
    newOrderRespType?: string;
    selfTradePreventionMode?: string;
    pegPriceType?: string;
    pegOffsetValue?: number;
    pegOffsetType?: string;
  },
): Promise<ISpotNewOrderResponse | IApiError> => {
  const endpoint = 'https://api.binance.com/api/v3/order';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISpotNewOrderResponse | IApiError>(
    credential,
    'POST',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * Cancel order (TRADE)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/trading-endpoints#%E6%92%A4%E9%94%80%E8%AE%A2%E5%8D%95-trade
 */
export const deleteSpotOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
    newClientOrderId?: string;
    cancelRestrictions?: string;
  },
): Promise<ISpotOrder | IApiError> => {
  const endpoint = 'https://api.binance.com/api/v3/order';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISpotOrder | IApiError>(credential, 'DELETE', endpoint, params, requestContext);
};

/**
 * 用户万向划转(USER_DATA)
 *
 * 用户万向划转
 *
 * 您需要开通api key 允许万向划转权限来调用此接口。
 *
 * 权重: 900
 *
 * https://developers.binance.com/docs/zh-CN/wallet/asset/user-universal-transfer
 */
export const postAssetTransfer = (
  credential: ICredential,
  params: {
    type: string;
    asset: string;
    amount: number;
    fromSymbol?: string;
    toSymbol?: string;
  },
): Promise<IAssetTransferResponse | IApiError> => {
  const endpoint = 'https://api.binance.com/sapi/v1/asset/transfer';
  const url = new URL(endpoint);
  const weight = 900;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IAssetTransferResponse | IApiError>(
    credential,
    'POST',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * 统一账户资金归集(TRADE)
 *
 * 资金归集到统一账户钱包
 *
 * 权重: 750
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Fund-Auto-collection
 *
 * ISSUE(2024-07-18): 目前这是唯一能够将资金从原 U 本位合约账户转入统一账户的接口。
 */
export const postUnifiedAccountAutoCollection = (credential: ICredential): Promise<{ msg: string }> => {
  const endpoint = 'https://papi.binance.com/papi/v1/auto-collection';
  const url = new URL(endpoint);
  const weight = 750;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<{ msg: string }>(credential, 'POST', endpoint, undefined, requestContext);
};

/**
 * 获取充值地址(支持多网络)(USER_DATA)
 *
 * 获取充值地址
 *
 * 权重: 10
 *
 * https://developers.binance.com/docs/zh-CN/wallet/capital/deposite-address
 */
export const getDepositAddress = (
  credential: ICredential,
  params: {
    coin: string;
    network?: string;
    amount?: number;
  },
): Promise<IDepositAddress> => {
  const endpoint = 'https://api.binance.com/sapi/v1/capital/deposit/address';
  const url = new URL(endpoint);
  const weight = 10;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IDepositAddress>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * 查询子账户列表(适用主账户)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/sub_account/account-management/Query-Sub-account-List
 */
export const getSubAccountList = (
  credential: ICredential,
  params?: {
    email?: string;
    isFreeze?: number;
    page?: number;
    limit?: number;
  },
): Promise<ISubAccountListResponse | IApiError> => {
  const endpoint = 'https://api.binance.com/sapi/v1/sub-account/list';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISubAccountListResponse | IApiError>(
    credential,
    'GET',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * 提币(USER_DATA)
 *
 * 权重: 600
 *
 * https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw
 */
export const postWithdraw = (
  credential: ICredential,
  params: {
    coin: string;
    withdrawOrderId?: string;
    network?: string;
    address: string;
    addressTag?: string;
    amount: number;
    transactionFeeFlag?: boolean;
    name?: string;
    walletType?: number;
  },
): Promise<{ id: string } | IApiError> => {
  const endpoint = 'https://api.binance.com/sapi/v1/capital/withdraw/apply';
  const url = new URL(endpoint);
  const weight = 600;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<{ id: string } | IApiError>(credential, 'POST', endpoint, params, requestContext);
};

/**
 * 获取提币历史(支持多网络)(USER_DATA)
 *
 * 获取提币历史 (支持多网络)
 *
 * 请求权重(IP)#
 * 18000 请求限制: 每秒10次
 *
 * 本接口特别采用每秒UID速率限制，用户的总秒级 UID 速率限制为180000/秒。从该接口收到的响应包含key X-SAPI-USED-UID-WEIGHT-1S，该key定义了当前 UID 使用的权重
 *
 * https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw-history
 */
export const getWithdrawHistory = (
  credential: ICredential,
  params?: {
    coin?: string;
    withdrawOrderId?: string;
    status?: number;
    offset?: number;
    limit?: number;
    startTime?: number;
    endTime?: number;
  },
): Promise<IWithdrawRecord[]> => {
  const endpoint = 'https://api.binance.com/sapi/v1/capital/withdraw/history';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IWithdrawRecord[]>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * 获取充值历史(支持多网络)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/wallet/capital/deposite-history
 */
export const getDepositHistory = (
  credential: ICredential,
  params?: {
    includeSource?: boolean;
    coin?: string;
    status?: number;
    startTime?: number;
    endTime?: number;
    offset?: number;
    limit?: number;
    txId?: string;
  },
): Promise<IDepositRecord[]> => {
  const endpoint = 'https://api.binance.com/sapi/v1/capital/deposit/hisrec';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IDepositRecord[]>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * UM下单(TRADE)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/trade/New-UM-Order
 */
export const postUmOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    side: string;
    positionSide?: string;
    type: string;
    timeInForce?: string;
    quantity: number;
    reduceOnly?: string;
    price?: number;
    newClientOrderId?: string;
    newOrderRespType?: string;
    selfTradePreventionMode?: string;
    goodTillDate?: number;
  },
): Promise<IUnifiedUmOrderResponse | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/order';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey('order/unified/minute', requestContext.ip);
  scopeError(
    'BINANCE_UNIFIED_ORDER_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUnifiedUmOrderResponse | IApiError>(
    credential,
    'POST',
    endpoint,
    params,
    requestContext,
  );
};

export const deleteUmOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
): Promise<IUnifiedUmOrderResponse | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/order';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey('order/unified/minute', requestContext.ip);
  scopeError(
    'BINANCE_UNIFIED_ORDER_API_RATE_LIMIT',
    { method: 'DELETE', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUnifiedUmOrderResponse | IApiError>(
    credential,
    'DELETE',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * 获取UM损益资金流水(USER_DATA)
 *
 * 权重: 30
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Get-UM-Income-History
 */
export const getUMIncome = (
  credential: ICredential,
  params?: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    recvWindow?: number;
    limit?: number;
    timestamp?: number;
  },
): Promise<IUMIncomeRecord[]> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/income';
  const url = new URL(endpoint);
  const weight = 30;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUMIncomeRecord[]>(credential, 'GET', endpoint, params, requestContext);
};
/**
 * 获取账户损益资金流水(USER_DATA)
 *
 * 权重: 30
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/account/rest-api/Get-Income-History
 */
export const getAccountIncome = (
  credential: ICredential,
  params?: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    page?: number;
    recvWindow?: number;
    limit?: number;
    timestamp?: number;
  },
): Promise<IAccountIncomeRecord[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/income';
  const url = new URL(endpoint);
  const weight = 30;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IAccountIncomeRecord[]>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * Cancel an Existing Order and Send a New Order (TRADE)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api/trading-endpoints#%E6%92%A4%E9%94%80%E5%B9%B6%E9%87%8D%E6%96%B0%E4%B8%8B%E5%8D%95-trade
 */
export const postSpotOrderCancelReplace = (
  credential: ICredential,
  params: {
    symbol: string;
    side: string;
    type: string;
    cancelReplaceMode: string;
    timeInForce?: string;
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    cancelNewClientOrderId?: string;
    cancelOrigClientOrderId?: string;
    cancelOrderId?: number;
    newClientOrderId?: string;
    strategyId?: number;
    strategyType?: number;
    stopPrice?: number;
    trailingDelta?: number;
    icebergQty?: number;
    newOrderRespType?: string;
    selfTradePreventionMode?: string;
    pegPriceType?: string;
    pegOffsetValue?: number;
    pegOffsetType?: string;
  },
): Promise<ISpotNewOrderResponse | IApiError> => {
  const endpoint = 'https://api.binance.com/api/v3/order/cancelReplace';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<ISpotNewOrderResponse | IApiError>(
    credential,
    'POST',
    endpoint,
    params,
    requestContext,
  );
};

/**
 * Modify Order (TRADE)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/trade/Modify-UM-Order
 */
export const putUmOrder = (
  credential: ICredential,
  params: {
    orderId?: number;
    origClientOrderId?: string;
    symbol: string;
    side: string;
    quantity?: number;
    price?: number;
    priceMatch?: string;
    recvWindow?: number;
    timestamp?: number;
  },
): Promise<IUnifiedUmOrderResponse | IApiError> => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/order';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'PUT', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IUnifiedUmOrderResponse | IApiError>(
    credential,
    'PUT',
    endpoint,
    params,
    requestContext,
  );
};
export interface IMarginPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  isMarginTrade: boolean;
  isBuyAllowed: boolean;
  isSellAllowed: boolean;
}

/**
 * 获取所有全仓杠杆交易对(MARKET_DATA)
 *
 * 权重: 1
 *
 * https://developers.binance.com/docs/zh-CN/margin_trading/market-data/Get-All-Cross-Margin-Pairs
 */
export const getMarginAllPairs = (params?: { symbol?: string }): Promise<IMarginPair[]> => {
  const credential = getDefaultCredential();
  const endpoint = 'https://api.binance.com/sapi/v1/margin/allPairs';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<IMarginPair[]>(credential, 'GET', endpoint, params, requestContext);
};

/**
 * Get a future hourly interest rate
 *
 * https://developers.binance.com/docs/zh-CN/margin_trading/borrow-and-repay/Get-a-future-hourly-interest-rate
 */
export const getMarginNextHourlyInterestRate = (params: {
  assets: string;
  isIsolated: boolean;
}): Promise<
  {
    asset: string;
    nextHourlyInterestRate: string;
  }[]
> => {
  const credential = getDefaultCredential();
  const endpoint = 'https://api.binance.com/sapi/v1/margin/next-hourly-interest-rate';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<
    {
      asset: string;
      nextHourlyInterestRate: string;
    }[]
  >(credential, 'GET', endpoint, params, requestContext);
};

/**
 * Query Margin Interest Rate History
 *
 * https://developers.binance.com/docs/zh-CN/margin_trading/borrow-and-repay/Query-Margin-Interest-Rate-History
 */
export const getMarginInterestRateHistory = (params: {
  asset: string;
  vipLevel?: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<
  {
    asset: string;
    dailyInterestRate: string;
    timestamp: number;
    vipLevel: number;
  }[]
> => {
  const credential = getDefaultCredential();
  const endpoint = 'https://api.binance.com/sapi/v1/margin/interestRateHistory';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<
    {
      asset: string;
      dailyInterestRate: string;
      timestamp: number;
      vipLevel: number;
    }[]
  >(credential, 'GET', endpoint, params, requestContext);
};

/**
 *获取用户持仓
 * @param credential
 *  https://developers.binance.com/docs/zh-CN/wallet/asset/user-assets#%E8%AF%B7%E6%B1%82%E5%8F%82%E6%95%B0
 * @param params
 * @returns
 */
export const getUserAsset = (
  credential: ICredential,
  params: {
    timestamp: number;
    asset?: string;
    needBtcValuation?: boolean;
    recvWindow?: number;
  },
) => {
  const endpoint = 'https://api.binance.com/sapi/v3/asset/getUserAsset';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<
    | {
        asset: string;
        free: string;
        locked: string;
        freeze: string;
        withdrawing: string;
        ipoable: string;
        btcValuation: string;
      }[]
    | IApiError
  >(credential, 'POST', endpoint, params, requestContext);
};

/**
 * 查询资金账户
 * @param credential
 * https://developers.binance.com/docs/zh-CN/wallet/asset/funding-wallet?utm_source=chatgpt.com
 * @param params
 * @returns
 */
export const getFundingAsset = (
  credential: ICredential,
  params: {
    timestamp: number;
    asset?: string;
    needBtcValuation?: boolean;
    recvWindow?: number;
  },
) => {
  const endpoint = 'https://api.binance.com/sapi/v1/asset/get-funding-asset';
  const url = new URL(endpoint);
  const weight = 1;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'POST', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<
    | {
        asset: string;
        free: string;
        locked: string;
        freeze: string;
        withdrawing: string;
        ipoable: string;
        btcValuation: string;
      }[]
    | IApiError
  >(credential, 'POST', endpoint, params, requestContext);
};

/**
 * UM账户成交历史 (USER_DATA)
 * @param credential
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/trade/UM-Account-Trade-List
 * @param params
 * @returns
 */
export const getUmAccountTradeList = (
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
) => {
  const endpoint = 'https://papi.binance.com/papi/v1/um/userTrades';
  const url = new URL(endpoint);
  const weight = 5;
  const requestContext = createRequestContext();
  const bucketKey = buildTokenBucketKey(url.host, requestContext.ip);
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: bucketKey, weight },
    () => tokenBucket(bucketKey, getTokenBucketOptions(url.host)).acquireSync(weight),
  );
  return requestPrivate<
    | {
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
    | IApiError
  >(credential, 'GET', endpoint, params, requestContext);
};
