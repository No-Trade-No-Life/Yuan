import { requestPrivate } from './client';
import { ICredential } from './types';

type ApiResponse<T> = {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
};

export interface IUtaAccountAsset {
  coin: string;
  equity: string;
  usdValue: string;
  balance: string;
  available: string;
  debt: string;
  locked: string;
}

export interface IUtaFundingAsset {
  coin: string;
  balance: string;
  available: string;
  frozen: string;
}

export interface IUtaPosition {
  category: string;
  symbol: string;
  marginCoin: string;
  holdMode: string;
  posSide: string;
  marginMode: string;
  positionBalance: string;
  available: string;
  frozen: string;
  total: string;
  leverage: string;
  curRealisedPnl: string;
  avgPrice: string;
  positionStatus: string;
  unrealisedPnl: string;
  liquidationPrice: string;
  mmr: string;
  profitRate: string;
  markPrice: string;
  breakEvenPrice: string;
  totalFunding: string;
  openFeeTotal: string;
  closeFeeTotal: string;
  createdTime: string;
  updatedTime: string;
}

export interface IUtaPendingOrderFeeDetail {
  feeCoin: string | null;
  fee: string | null;
}

export interface IUtaPendingOrder {
  orderId: string;
  clientOid: string;
  category: string;
  symbol: string;
  orderType: string;
  side: string;
  price: string;
  qty: string;
  amount: string;
  cumExecQty: string;
  cumExecValue: string;
  avgPrice: string;
  timeInForce: string;
  orderStatus: string;
  posSide: string;
  holdMode: string;
  stpMode?: string;
  reduceOnly?: string;
  feeDetail: IUtaPendingOrderFeeDetail[];
  createdTime: string;
  updatedTime: string;
}

export interface IUtaSymbolConfig {
  category: string;
  symbol: string;
  marginMode: string;
  leverage: string;
}

export interface IUtaCoinConfig {
  coin: string;
  leverage: string;
}

export interface IUtaAccountSettings {
  uid: string;
  accountMode: string;
  assetMode: string;
  holdMode: string;
  stpMode: string;
  symbolConfigList: IUtaSymbolConfig[];
  coinConfigList: IUtaCoinConfig[];
}

/**
 * 获取统一账户资产
 *
 * 限速规则: 20次/1s (UID)
 *
 * 查询账户信息与资产（仅返回非 0 余额）
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/account/Get-Account
 */
export const getAccountAssets = (credential: ICredential) =>
  requestPrivate<
    ApiResponse<{
      accountEquity: string;
      usdtEquity: string;
      btcEquity: string;
      unrealisedPnl: string;
      usdtUnrealisedPnl: string;
      btcUnrealizedPnl: string;
      effEquity: string;
      mmr: string;
      imr: string;
      mgnRatio: string;
      positionMgnRatio: string;
      assets: IUtaAccountAsset[];
    }>
  >(credential, 'GET', '/api/v3/account/assets');

/**
 * 获取统一账户设置
 *
 * 限速规则: 20次/1s (UID)
 *
 * 查询持仓/保证金模式、杠杆等账户配置
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/account/Get-Account-Setting
 */
export const getAccountSettings = (credential: ICredential) =>
  requestPrivate<ApiResponse<IUtaAccountSettings>>(credential, 'GET', '/api/v3/account/settings');

/**
 * 获取资金账户资产
 *
 * 限速规则: 20次/1s (UID)
 *
 * 仅返回有资产的币种
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/account/Get-Account-Funding-Assets
 */
export const getAccountFundingAssets = (credential: ICredential, params?: { coin?: string }) =>
  requestPrivate<ApiResponse<IUtaFundingAsset[]>>(
    credential,
    'GET',
    '/api/v3/account/funding-assets',
    params,
  );

/**
 * 查询持仓
 *
 * 限速规则: 20次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/trade/Get-Position
 */
export const getCurrentPosition = (
  credential: ICredential,
  params: { category: string; symbol?: string; posSide?: string },
) =>
  requestPrivate<
    ApiResponse<{
      list: IUtaPosition[];
    }>
  >(credential, 'GET', '/api/v3/position/current-position', params);

/**
 * 查询未成交订单
 *
 * 限速规则: 20次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/trade/Get-Order-Pending
 */
export const getUnfilledOrders = (
  credential: ICredential,
  params?: {
    category?: string;
    symbol?: string;
    startTime?: string;
    endTime?: string;
    limit?: string;
    cursor?: string;
  },
) =>
  requestPrivate<
    ApiResponse<{
      list: IUtaPendingOrder[];
      cursor?: string;
    }>
  >(credential, 'GET', '/api/v3/trade/unfilled-orders', params);

/**
 * 下单
 *
 * 限速规则: 10次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/trade/Place-Order
 */
export const postPlaceOrder = (
  credential: ICredential,
  params: {
    category: string;
    symbol: string;
    qty: string;
    side: string;
    orderType: string;
    price?: string;
    timeInForce?: string;
    posSide?: string;
    clientOid?: string;
    reduceOnly?: string;
    stpMode?: string;
    tpTriggerBy?: string;
    slTriggerBy?: string;
    takeProfit?: string;
    stopLoss?: string;
    tpOrderType?: string;
    slOrderType?: string;
    tpLimitPrice?: string;
    slLimitPrice?: string;
  },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v3/trade/place-order',
    params,
  );

/**
 * 撤单
 *
 * 限速规则: 10次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/trade/Cancel-Order
 */
export const postCancelOrder = (
  credential: ICredential,
  params: { orderId?: string; clientOid?: string; category?: string },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v3/trade/cancel-order',
    params,
  );

/**
 * 改单
 *
 * 限速规则: 10次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/trade/Modify-Order
 */
export const postModifyOrder = (
  credential: ICredential,
  params: {
    orderId?: string;
    clientOid?: string;
    qty?: string;
    price?: string;
    autoCancel?: string;
    symbol?: string;
    category?: string;
  },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v3/trade/modify-order',
    params,
  );

interface IWithdrawalRecord {
  orderId: string;
  tradeId: string;
  coin: string;
  clientOid: string;
  type: string;
  dest: string;
  size: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  chain: string;
  cTime: string;
}

interface IDepositRecord {
  orderId: string;
  tradeId: string;
  coin: string;
  type: string;
  dest: string;
  size: string;
  status: string;
  fromAddress: string;
  toAddress: string;
  chain: string;
  cTime: string;
}

/**
 * 资产划转
 */
export const postTransfer = (
  credential: ICredential,
  params: {
    fromType: string;
    toType: string;
    amount: string;
    coin: string;
    symbol?: string;
    clientOid?: string;
  },
) =>
  requestPrivate<ApiResponse<{ transferId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v2/spot/wallet/transfer',
    params,
  );

/**
 * 子母账户划转
 */
export const postSubAccountTransfer = (
  credential: ICredential,
  params: {
    fromType: string;
    toType: string;
    amount: string;
    coin: string;
    symbol?: string;
    clientOid?: string;
    fromUserId: string;
    toUserId: string;
  },
) =>
  requestPrivate<ApiResponse<{ transferId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v2/spot/wallet/subaccount-transfer',
    params,
  );

/**
 * 提币
 */
export const postWithdraw = (
  credential: ICredential,
  params: {
    coin: string;
    transferType: string;
    address: string;
    chain: string;
    innerToType?: string;
    areaCode?: string;
    tag?: string;
    size: string;
    remark?: string;
    clientOid?: string;
  },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v2/spot/wallet/withdrawal',
    params,
  );

/**
 * 获取充币地址
 */
export const getDepositAddress = (credential: ICredential, params: { coin: string; chain?: string }) =>
  requestPrivate<
    ApiResponse<{
      address: string;
      chain: string;
      coin: string;
      tag: string;
      url: string;
    }>
  >(credential, 'GET', '/api/v2/spot/wallet/deposit-address', params);

/**
 * 获取提币记录
 */
export const getWithdrawalRecords = (
  credential: ICredential,
  params: {
    coin?: string;
    clientOid?: string;
    orderId?: string;
    startTime: string;
    endTime: string;
    idLessThan?: string;
    limit?: string;
  },
) =>
  requestPrivate<ApiResponse<IWithdrawalRecord[]>>(
    credential,
    'GET',
    '/api/v2/spot/wallet/withdrawal-records',
    params,
  );

/**
 * 获取充币记录
 */
export const getDepositRecords = (
  credential: ICredential,
  params: {
    coin?: string;
    orderId?: string;
    startTime: string;
    endTime: string;
    idLessThan?: string;
    limit?: string;
  },
) =>
  requestPrivate<ApiResponse<IDepositRecord[]>>(
    credential,
    'GET',
    '/api/v2/spot/wallet/deposit-records',
    params,
  );

/**
 * 查询子账户列表
 */
export const getVirtualSubAccountList = (
  credential: ICredential,
  params?: { status?: string; limit?: string; idLessThan?: string },
) =>
  requestPrivate<
    ApiResponse<{
      subAccountList?: {
        subAccountUid: string;
        subAccountName: string;
        label: string;
        status: string;
      }[];
    }>
  >(credential, 'GET', '/api/v2/user/virtual-subaccount-list', params);

export interface ISpotCrossInterestRate {
  coin: string;
  interestRate: string;
  dailyInterestRate: string;
  annualInterestRate: string;
  borrowable: boolean;
  maxBorrowableAmount: string;
}

/**
 * 获取全仓杠杆利率和限额
 *
 * 限速规则: 20次/1s (IP)
 *
 * https://www.bitget.com/zh-CN/api-doc/margin/cross/account/Get-Cross-Margin-Interest-Rate-And-Borrowable
 */
export const getSpotCrossInterestRate = (
  credential: ICredential,
  params: {
    coin: string;
  },
) =>
  requestPrivate<ApiResponse<ISpotCrossInterestRate[]>>(
    credential,
    'GET',
    '/api/v2/margin/crossed/interest-rate-and-limit',
    params,
  );
