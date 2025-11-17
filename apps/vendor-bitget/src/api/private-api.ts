import { getDefaultCredential, requestPrivate } from './client';
import { ICredential } from './types';

type ApiResponse<T> = {
  code: string;
  msg: string;
  requestTime: number;
  data: T;
};

interface IFuturePendingOrder {
  orderId: string;
  clientOid: string;
  symbol: string;
  productType: string;
  marginCoin: string;
  size: string;
  filledQty: string;
  price: string;
  priceAvg: string;
  state: string;
  orderType: string;
  side: string;
  tradeSide?: string;
  posSide?: string;
  marginMode?: string;
  reduceOnly?: string;
  createdTime?: string;
  cTime?: string;
  uTime?: string;
}

interface ISpotPendingOrder {
  orderId?: string;
  clientOid?: string;
  symbol?: string;
  instId?: string;
  orderType?: string;
  side?: string;
  size?: string;
  quantity?: string;
  baseSz?: string;
  baseAmount?: string;
  fillSz?: string;
  filledQty?: string;
  baseFilled?: string;
  cTime?: string;
  createTime?: string;
  createdTime?: string;
  price?: string;
}

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
 * 资产概览
 *
 * 限速规则: 1次/1s (Uid)
 *
 * https://www.bitget.com/zh-CN/api-doc/common/account/All-Account-Balance
 */
export const getAllAccountBalance = (credential: ICredential) =>
  requestPrivate<
    ApiResponse<
      {
        accountType: string;
        usdtBalance: string;
      }[]
    >
  >(credential, 'GET', '/api/v2/account/all-account-balance');

/**
 * 获取账户信息
 *
 * 限速规则 1次/秒/UID
 *
 * 获取账户信息 (需要现货只读或者读写权限)
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Account-Info
 */
export const getAccountInfo = (credential: ICredential) =>
  requestPrivate<
    ApiResponse<{
      userId: string;
      inviterId: string;
      channelCode: string;
      channel: string;
      ips: string;
      authorities: string[];
      parentId: number;
      traderType: string;
      regisTime: string;
    }>
  >(credential, 'GET', '/api/v2/spot/account/info');

/**
 * 获取账户信息列表
 *
 * 限速规则: 10次/1s (uid)
 *
 * 查询某产品类型下所有账户信息
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/account/Get-Account-List
 */
export const getFutureAccounts = (credential: ICredential, params: { productType: string }) =>
  requestPrivate<
    ApiResponse<
      {
        marginCoin: string;
        locked: string;
        available: string;
        crossedMaxAvailable: string;
        isolatedMaxAvailable: string;
        maxTransferOut: string;
        accountEquity: string;
        usdtEquity: string;
        btcEquity: string;
        crossedRiskRate: string;
        unrealizedPL: string;
        coupon: string;
      }[]
    >
  >(credential, 'GET', '/api/v2/mix/account/accounts', params);

/**
 * 获取全部合约仓位信息
 * 5次/S 根据uid限频
 *
 * 返回指定productType当前全部的持仓信息
 *
 * 此接口返回数据可能会在以下场景下出现延迟，建议订阅Websocket监控仓位信息：
 * 资金费率结算时
 * 行情波动剧烈
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/position/get-all-position
 */
export const getAllPositions = (
  credential: ICredential,
  params: { productType: string; marginCoin: string },
) =>
  requestPrivate<
    ApiResponse<
      {
        symbol: string;
        marginCoin: string;
        holdSide: string;
        openDelegateSize: string;
        marginSize: string;
        available: string;
        locked: string;
        total: string;
        leverage: string;
        achievedProfits: string;
        openPriceAvg: string;
        marginMode: string;
        posMode: string;
        unrealizedPL: string;
        liquidationPrice: string;
        keepMarginRate: string;
        markPrice: string;
        breakEvenPrice: string;
        totalFee: string;
        deductedFee: string;
        cTime: string;
      }[]
    >
  >(credential, 'GET', '/api/v2/mix/position/all-position', params);

/**
 * 获取合约未完成订单列表
 *
 * 限速规则: 10次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/trade/Get-Orders-Pending
 */
export const getFutureOrdersPending = (
  credential: ICredential,
  params: {
    productType: string;
    symbol?: string;
    marginCoin?: string;
    isPlan?: string;
    orderType?: string;
    startTime?: string;
    endTime?: string;
    pageSize?: string;
    lastEndId?: string;
  },
) =>
  requestPrivate<
    ApiResponse<{
      nextFlag: boolean;
      endId: string;
      orderList: IFuturePendingOrder[];
    }>
  >(credential, 'GET', '/api/v2/mix/order/orders-pending', params);

/**
 * 获取现货未完成订单
 *
 * 限速规则 20次/1s (UID)
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/trade/Get-Unfilled-Orders
 */
export const getSpotOrdersPending = (
  credential: ICredential,
  params?: {
    symbol?: string;
    startTime?: string;
    endTime?: string;
    idLessThan?: string;
    limit?: string;
    orderId?: string;
    tpslType?: string;
    requestTime?: string;
    receiveWindow?: string;
  },
) =>
  requestPrivate<ApiResponse<ISpotPendingOrder[]>>(
    credential,
    'GET',
    '/api/v2/spot/trade/unfilled-orders',
    params,
  );

/**
 * 下单
 *
 * 普通用户:限速10次/秒，根据uid限频
 *
 * 跟单交易员:限速1次/秒，根据uid限频
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/trade/Place-Order
 */
export const postFuturePlaceOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    productType: string;
    marginMode: string;
    marginCoin: string;
    size: string;
    price?: string;
    side: string;
    tradeSide?: string;
    orderType: string;
    force?: string;
    clientOid?: string;
    reduceOnly?: string;
    presetStopSurplusPrice?: string;
    presetStopLossPrice?: string;
  },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v2/mix/order/place-order',
    params,
  );

/**
 * 撤单
 *
 * 限速规则: 10次/1s
 *
 * https://www.bitget.com/zh-CN/api-doc/contract/trade/Cancel-Order
 */
export const postFutureCancelOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    productType: string;
    marginCoin?: string;
    orderId?: string;
    clientOid?: string;
  },
) =>
  requestPrivate<ApiResponse<{ orderId: string; clientOid: string }>>(
    credential,
    'POST',
    '/api/v2/mix/order/cancel-order',
    params,
  );

/**
 * 划转
 *
 * 限速规则 10次/1s (UID)
 *
 * 资产划转
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Wallet-Transfer
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
 *
 * 限速规则 20次/1s (UID)
 *
 * 子母账户资产划转，该接口支持的划转类型包括
 *
 * 母账户转子账户（仅母账户APIKey有权限）
 * 子账户转母账户（仅母账户APIKey有权限）
 * 子账户转子账户（仅母账户APIKey有权限，并要求发起与接收方子账户归属于同一母账户）
 * 子账户内部划转（仅母账户APIKey有权限，并要求发起与接收方子账户为同一子账户）
 * 请求参数中的转入及转出账户UID须为母子/兄弟关系，且所有转账操作均只有母账户才有操作权限
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Sub-Transfer
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
 *
 * 限速规则 5次/1s (UID)
 *
 * 提币接口 包括链上提币和内部提币。(需要在网页端添加地址到地址簿中)
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Wallet-Withdrawal
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
 *
 * 限速规则 10 次/1s (UID)
 *
 * 获取当前账号充币地址
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Deposit-Address
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
 *
 * 限速规则 10次/1s (UID)
 *
 * 获取提币记录
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Withdraw-Record
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
 *
 * 限速规则 10次/1s (UID)
 *
 * 获取充币记录(不包含法币充值)
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Deposit-Record
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
 * 获取账户现货资产
 *
 * 限速规则 10次/1s (UID)
 *
 * 获取账户币种资产
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Account-Assets
 */
export const getSpotAssets = (credential: ICredential, params?: { coin?: string; assetType?: string }) =>
  requestPrivate<
    ApiResponse<
      {
        coin: string;
        available: string;
        frozen: string;
        locked: string;
        limitAvailable: string;
        uTime: string;
      }[]
    >
  >(credential, 'GET', '/api/v2/spot/account/assets', params);

/**
 * 获取所有子账户现货资产
 *
 * 限速规则 10次/1s (UID)
 *
 * 获取所有子账户现货资产。仅限非代理商(非ND Broker)用户调用。
 *
 * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Subaccount-Assets
 */
export const getSubAccountSpotAssets = (credential: ICredential) =>
  requestPrivate<
    ApiResponse<{
      userId: string;
      assetsList: {
        coin: string;
        available: string;
        limitAvailable: string;
        frozen: string;
        locked: string;
        uTime: string;
      }[];
    }>
  >(credential, 'GET', '/api/v2/spot/account/subaccount-assets');

/**
 * 查询子账户列表
 *
 * 限速规则 1次/1s (UID)
 *
 * 查询子账户列表
 *
 * https://www.bitget.com/zh-CN/api-doc/common/vsubaccount/Get-Virtual-Subaccount-List
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

/**
 * 获取财务记录
 *
 * 限速规则 20次/1s (UID)
 *
 * 获取财务记录
 *
 * https://www.bitget.com/zh-CN/api-doc/uta/account/Get-Financial-Records
 */
export const getAccountFinancialRecord = (
  credential: ICredential,
  params?: {
    category: string;
    coin?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    limit?: string;
    cursor?: string;
  },
) => requestPrivate<ApiResponse<unknown>>(credential, 'GET', '/api/v3/account/financial-records', params);

export { getDefaultCredential };
export type { ICredential };
