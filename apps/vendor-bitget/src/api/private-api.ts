import { getDefaultCredential, requestPrivate } from './client';
import { ICredential } from './types';

export const getAllAccountBalance = (credential: ICredential): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v2/account/all-account-balance');

export const getAccountInfo = (credential: ICredential): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v2/spot/account/info');

export const getFutureAccounts = (credential: ICredential, params: { productType: string }): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v2/mix/account/accounts', params);

export const getAllPositions = (
  credential: ICredential,
  params: { productType: string; marginCoin: string },
): Promise<any> => requestPrivate(credential, 'GET', '/api/v2/mix/position/all-position', params);

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
) => requestPrivate(credential, 'GET', '/api/v2/mix/order/orders-pending', params);

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
) => requestPrivate(credential, 'GET', '/api/v2/spot/trade/orders-pending', params);

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
) => requestPrivate(credential, 'POST', '/api/v2/mix/order/place-order', params);

export const postFutureCancelOrder = (
  credential: ICredential,
  params: {
    symbol: string;
    productType: string;
    marginCoin?: string;
    orderId?: string;
    clientOid?: string;
  },
) => requestPrivate(credential, 'POST', '/api/v2/mix/order/cancel-order', params);

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
) => requestPrivate(credential, 'POST', '/api/v2/spot/wallet/transfer', params);

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
) => requestPrivate(credential, 'POST', '/api/v2/spot/wallet/subaccount-transfer', params);

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
) => requestPrivate(credential, 'POST', '/api/v2/spot/wallet/withdrawal', params);

export const getDepositAddress = (
  credential: ICredential,
  params: { coin: string; chain?: string },
): Promise<any> => requestPrivate(credential, 'GET', '/api/v2/spot/wallet/deposit-address', params);

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
) => requestPrivate(credential, 'GET', '/api/v2/spot/wallet/withdrawal-records', params);

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
) => requestPrivate(credential, 'GET', '/api/v2/spot/wallet/deposit-records', params);

export const getSpotAssets = (
  credential: ICredential,
  params?: { coin?: string; assetType?: string },
): Promise<any> => requestPrivate(credential, 'GET', '/api/v2/spot/account/assets', params);

export const getSubAccountSpotAssets = (credential: ICredential): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v2/spot/account/subaccount-assets');

export const getVirtualSubAccountList = (
  credential: ICredential,
  params?: { status?: string; limit?: string; idLessThan?: string },
) => requestPrivate(credential, 'GET', '/api/v2/user/virtual-subaccount-list', params);

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
) => requestPrivate(credential, 'GET', '/api/v3/account/financial-records', params);

export { getDefaultCredential };
export type { ICredential };
