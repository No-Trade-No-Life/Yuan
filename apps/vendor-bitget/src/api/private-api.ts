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

export const getAllAccountBalance = (credential: ICredential) =>
  requestPrivate<
    ApiResponse<
      {
        accountType: string;
        usdtBalance: string;
      }[]
    >
  >(credential, 'GET', '/api/v2/account/all-account-balance');

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

export const getSpotOrdersPending = (
  credential: ICredential,
  params?: {
    symbol?: string;
    side?: string;
    orderType?: string;
    limit?: string;
    after?: string;
    before?: string;
  },
) =>
  requestPrivate<
    ApiResponse<{
      orderList?: ISpotPendingOrder[];
      orders?: ISpotPendingOrder[];
      resultList?: ISpotPendingOrder[];
    }>
  >(credential, 'GET', '/api/v2/spot/trade/orders-pending', params);

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
