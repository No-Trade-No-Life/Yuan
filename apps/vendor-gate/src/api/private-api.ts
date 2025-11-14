import { requestPrivate } from './client';
import { IGateCredential } from './types';

export const getAccountDetail = (credential: IGateCredential): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v4/account/detail');

export const getFuturePositions = (
  credential: IGateCredential,
  settle: string,
  params?: { holding?: boolean; limit?: number; offset?: number },
): Promise<any> => requestPrivate(credential, 'GET', `/api/v4/futures/${settle}/positions`, params);

export const getFuturesAccounts = (credential: IGateCredential, settle: string): Promise<any> =>
  requestPrivate(credential, 'GET', `/api/v4/futures/${settle}/accounts`);

export const getFuturesOrders = (
  credential: IGateCredential,
  settle: string,
  params: { contract?: string; status: string; limit?: number; offset?: number; last_id?: number },
): Promise<any> => requestPrivate(credential, 'GET', `/api/v4/futures/${settle}/orders`, params);

export const postFutureOrders = (credential: IGateCredential, settle: string, params: any): Promise<any> =>
  requestPrivate(credential, 'POST', `/api/v4/futures/${settle}/orders`, params);

export const deleteFutureOrders = (
  credential: IGateCredential,
  settle: string,
  order_id: string,
): Promise<any> => requestPrivate(credential, 'DELETE', `/api/v4/futures/${settle}/orders/${order_id}`);

export const getUnifiedAccounts = (credential: IGateCredential, params: { currency?: string }): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v4/unified/accounts', params);

export const getSpotAccounts = (credential: IGateCredential, params?: { currency?: string }): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v4/spot/accounts', params);

export const postWalletTransfer = (credential: IGateCredential, params: any): Promise<any> =>
  requestPrivate(credential, 'POST', '/api/v4/wallet/transfers', params);

export const getDepositAddress = (credential: IGateCredential, params: { currency: string }): Promise<any> =>
  requestPrivate(credential, 'GET', '/api/v4/wallet/deposit_address', params);

export const postWithdrawals = (credential: IGateCredential, params: any): Promise<any> =>
  requestPrivate(credential, 'POST', '/api/v4/withdrawals', params);

export const getWithdrawalHistory = (
  credential: IGateCredential,
  params?: { currency?: string; from?: number; to?: number; limit?: number; offset?: number },
): Promise<any> => requestPrivate(credential, 'GET', '/api/v4/wallet/withdrawals', params);

export const getDepositHistory = (
  credential: IGateCredential,
  params?: { currency?: string; from?: number; to?: number; limit?: number; offset?: number },
): Promise<any> => requestPrivate(credential, 'GET', '/api/v4/wallet/deposits', params);
