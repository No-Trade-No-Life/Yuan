import { requestPrivate } from './client';
import { IBinanceCredential, IBinanceErrorResponse } from './types';

export const getUnifiedAccountInfo = (credential: IBinanceCredential) =>
  requestPrivate<
    | {
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
    | IBinanceErrorResponse
  >(credential, 'GET', 'https://papi.binance.com/papi/v1/account');

export const getUnifiedUmAccount = (credential: IBinanceCredential) =>
  requestPrivate<
    | {
        assets: {
          asset: string;
          crossWalletBalance: string;
          crossUnPnl: string;
          maintMargin: string;
          initialMargin: string;
          positionInitialMargin: string;
          openOrderInitialMargin: string;
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
          entryPrice: string;
          maxNotional: string;
          bidNotional: string;
          askNotional: string;
          positionSide: string;
          positionAmt: string;
          updateTime: number;
        }[];
      }
    | IBinanceErrorResponse
  >(credential, 'GET', 'https://papi.binance.com/papi/v1/um/account');

export const getUnifiedUmOpenOrders = (credential: IBinanceCredential, params?: { symbol?: string }) =>
  requestPrivate<
    {
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
    }[]
  >(credential, 'GET', 'https://papi.binance.com/papi/v1/um/openOrders', params);

export const getUnifiedAccountBalance = (credential: IBinanceCredential, params?: { assets?: string }) =>
  requestPrivate<
    | {
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
      }[]
    | IBinanceErrorResponse
  >(credential, 'GET', 'https://papi.binance.com/papi/v1/balance', params);

export const getSpotAccountInfo = (credential: IBinanceCredential, params?: { omitZeroBalances?: boolean }) =>
  requestPrivate<
    | {
        makerCommission: number;
        takerCommission: number;
        buyerCommission: number;
        sellerCommission: number;
        commissionRates: { maker: string; taker: string; buyer: string; seller: string };
        canTrade: boolean;
        canWithdraw: boolean;
        canDeposit: boolean;
        brokered: boolean;
        requireSelfTradePrevention: boolean;
        preventSor: boolean;
        updateTime: number;
        balances: { asset: string; free: string; locked: string }[];
        permissions: string[];
        uid: number;
      }
    | IBinanceErrorResponse
  >(credential, 'GET', 'https://api.binance.com/api/v3/account', params);

export const postAssetTransfer = (
  credential: IBinanceCredential,
  params: { type: string; asset: string; amount: number; fromSymbol?: string; toSymbol?: string },
) =>
  requestPrivate<
    | {
        tranId: number;
      }
    | IBinanceErrorResponse
  >(credential, 'POST', 'https://api.binance.com/sapi/v1/asset/transfer', params);

export const postUnifiedAccountAutoCollection = (credential: IBinanceCredential) =>
  requestPrivate<{ msg: string }>(credential, 'POST', 'https://papi.binance.com/papi/v1/auto-collection');

export const getDepositAddress = (credential: IBinanceCredential, params: { coin: string; network?: string; amount?: number }) =>
  requestPrivate<{ address: string; coin: string; tag: string; url: string }>(
    credential,
    'GET',
    'https://api.binance.com/sapi/v1/capital/deposit/address',
    params,
  );

export const getSubAccountList = (
  credential: IBinanceCredential,
  params?: { email?: string; isFreeze?: number; page?: number; limit?: number },
) =>
  requestPrivate<
    | {
        subAccounts: {
          email: string;
          isFreeze: boolean;
          createTime: number;
          isManagedSubAccount: boolean;
          isAssetManagementSubAccount: boolean;
        }[];
      }
    | IBinanceErrorResponse
  >(credential, 'GET', 'https://api.binance.com/sapi/v1/sub-account/list', params);

export const postWithdraw = (
  credential: IBinanceCredential,
  params:
    | {
        coin: string;
        withdrawOrderId?: string;
        network?: string;
        address: string;
        addressTag?: string;
        amount: number;
        transactionFeeFlag?: boolean;
        name?: string;
        walletType?: number;
      }
    | IBinanceErrorResponse,
) => requestPrivate<{ id: string }>(credential, 'POST', 'https://api.binance.com/sapi/v1/capital/withdraw/apply', params);

export const getWithdrawHistory = (
  credential: IBinanceCredential,
  params?: { coin?: string; withdrawOrderId?: string; status?: number; offset?: number; limit?: number; startTime?: number; endTime?: number },
) =>
  requestPrivate<
    {
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
    }[]
  >(credential, 'GET', 'https://api.binance.com/sapi/v1/capital/withdraw/history', params);

export const getDepositHistory = (
  credential: IBinanceCredential,
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
) =>
  requestPrivate<
    {
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
    }[]
  >(credential, 'GET', 'https://api.binance.com/sapi/v1/capital/deposit/hisrec', params);

export const postUmOrder = (
  credential: IBinanceCredential,
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
) =>
  requestPrivate<
    | {
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
    | IBinanceErrorResponse
  >(credential, 'POST', 'https://papi.binance.com/papi/v1/um/order', params);

export const deleteUmOrder = (
  credential: IBinanceCredential,
  params: { symbol: string; orderId?: string | number; origClientOrderId?: string },
) =>
  requestPrivate<
    | {
        clientOrderId: string;
        cumQty: string;
        cumQuote: string;
        executedQty: string;
        orderId: number;
        origQty: string;
        price: string;
        reduceOnly: boolean;
        side: string;
        positionSide: string;
        status: string;
        symbol: string;
        timeInForce: string;
        type: string;
        updateTime: number;
      }
    | IBinanceErrorResponse
  >(credential, 'DELETE', 'https://papi.binance.com/papi/v1/um/order', params);

export const getUMIncome = (
  credential: IBinanceCredential,
  params?: { symbol?: string; incomeType?: string; startTime?: number; endTime?: number; recvWindow?: number; limit?: number; timestamp: number },
) =>
  requestPrivate<
    {
      symbol: string;
      incomeType: string;
      income: string;
      asset: string;
      info: string;
      time: number;
      tranId: string;
      tradeId: string;
    }[]
  >(credential, 'GET', 'https://api.binance.com/papi/v1/um/income', params);
