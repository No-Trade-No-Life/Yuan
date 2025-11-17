import { IApiError, ICredential, requestPrivate } from './client';
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

/**
 * 查询账户信息(USER_DATA)
 *
 * 查询账户信息
 *
 * 权重: 20
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Account-Information
 */
export const getUnifiedAccountInfo = (credential: ICredential): Promise<IUnifiedAccountInfo | IApiError> =>
  requestPrivate<IUnifiedAccountInfo | IApiError>(
    credential,
    'GET',
    'https://papi.binance.com/papi/v1/account',
  );

/**
 * 获取UM账户信息
 *
 * 现有UM账户资产和仓位信息
 *
 * 权重: 5
 *
 * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Get-UM-Account-Detail
 */
export const getUnifiedUmAccount = (credential: ICredential): Promise<IUnifiedUmAccount | IApiError> =>
  requestPrivate<IUnifiedUmAccount | IApiError>(
    credential,
    'GET',
    'https://papi.binance.com/papi/v1/um/account',
  );

/**
 * 查看当前全部UM挂单(USER_DATA)
 *
 * 查看当前全部UM挂单，请小心使用不带symbol参数的调用
 *
 * 权重: 带symbol 1 - 不带 40
 */
export const getUnifiedUmOpenOrders = (
  credential: ICredential,
  params?: {
    symbol?: string;
  },
): Promise<IUnifiedUmOpenOrder[]> =>
  requestPrivate<IUnifiedUmOpenOrder[]>(
    credential,
    'GET',
    'https://papi.binance.com/papi/v1/um/openOrders',
    params,
  );

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
): Promise<IUnifiedAccountBalanceEntry[] | IApiError> =>
  requestPrivate<IUnifiedAccountBalanceEntry[] | IApiError>(
    credential,
    'GET',
    'https://papi.binance.com/papi/v1/balance',
    params,
  );

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
): Promise<ISpotAccountInfo | IApiError> =>
  requestPrivate<ISpotAccountInfo | IApiError>(
    credential,
    'GET',
    'https://api.binance.com/api/v3/account',
    params,
  );

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
): Promise<IAssetTransferResponse | IApiError> =>
  requestPrivate<IAssetTransferResponse | IApiError>(
    credential,
    'POST',
    'https://api.binance.com/sapi/v1/asset/transfer',
    params,
  );

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
export const postUnifiedAccountAutoCollection = (credential: ICredential): Promise<{ msg: string }> =>
  requestPrivate<{ msg: string }>(credential, 'POST', 'https://papi.binance.com/papi/v1/auto-collection');

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
): Promise<IDepositAddress> =>
  requestPrivate<IDepositAddress>(
    credential,
    'GET',
    'https://api.binance.com/sapi/v1/capital/deposit/address',
    params,
  );

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
): Promise<ISubAccountListResponse | IApiError> =>
  requestPrivate<ISubAccountListResponse | IApiError>(
    credential,
    'GET',
    'https://api.binance.com/sapi/v1/sub-account/list',
    params,
  );

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
): Promise<{ id: string } | IApiError> =>
  requestPrivate<{ id: string } | IApiError>(
    credential,
    'POST',
    'https://api.binance.com/sapi/v1/capital/withdraw/apply',
    params,
  );

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
): Promise<IWithdrawRecord[]> =>
  requestPrivate<IWithdrawRecord[]>(
    credential,
    'GET',
    'https://api.binance.com/sapi/v1/capital/withdraw/history',
    params,
  );

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
): Promise<IDepositRecord[]> =>
  requestPrivate<IDepositRecord[]>(
    credential,
    'GET',
    'https://api.binance.com/sapi/v1/capital/deposit/hisrec',
    params,
  );

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
): Promise<IUnifiedUmOrderResponse | IApiError> =>
  requestPrivate<IUnifiedUmOrderResponse | IApiError>(
    credential,
    'POST',
    'https://papi.binance.com/papi/v1/um/order',
    params,
  );

export const deleteUmOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    orderId?: string | number;
    origClientOrderId?: string;
  },
): Promise<IUnifiedUmOrderResponse | IApiError> =>
  requestPrivate<IUnifiedUmOrderResponse | IApiError>(
    credential,
    'DELETE',
    'https://papi.binance.com/papi/v1/um/order',
    params,
  );

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
): Promise<IUMIncomeRecord[]> =>
  requestPrivate<IUMIncomeRecord[]>(credential, 'GET', 'https://api.binance.com/papi/v1/um/income', params);
