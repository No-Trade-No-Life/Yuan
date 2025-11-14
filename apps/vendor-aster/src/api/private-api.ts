import { requestPerpetualPrivate, requestSpotPrivate } from './client';
import { IAsterCredential } from './types';

export const getFApiV4Account = (credential: IAsterCredential) =>
  requestPerpetualPrivate<
    {
      feeTier: number;
      canTrade: boolean;
      canDeposit: boolean;
      canWithdraw: boolean;
      updateTime: number;
      totalInitialMargin: string;
      totalMaintMargin: string;
      totalWalletBalance: string;
      totalUnrealizedProfit: string;
      totalMarginBalance: string;
      totalPositionInitialMargin: string;
      totalOpenOrderInitialMargin: string;
      totalCrossWalletBalance: string;
      totalCrossUnPnl: string;
      availableBalance: string;
      maxWithdrawAmount: string;
      assets: {
        asset: string;
        walletBalance: string;
        unrealizedProfit: string;
        marginBalance: string;
        maintMargin: string;
        initialMargin: string;
        positionInitialMargin: string;
        openOrderInitialMargin: string;
        maxWithdrawAmount: string;
        crossWalletBalance: string;
        crossUnPnl: string;
        availableBalance: string;
        marginAvailable: boolean;
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
        isolated: boolean;
        entryPrice: string;
        maxNotional: string;
        positionSide: 'BOTH' | 'LONG' | 'SHORT';
        positionAmt: string;
        notional: string;
        isolatedWallet: string;
        updateTime: number;
      }[];
    }
  >(credential, 'GET', '/fapi/v4/account');

export const getFApiV2Balance = (credential: IAsterCredential) =>
  requestPerpetualPrivate<
    {
      accountAlias: string;
      asset: string;
      balance: string;
      crossWalletBalance: string;
      crossUnPnl: string;
      availableBalance: string;
      maxWithdrawAmount: string;
      marginAvailable: boolean;
      updateTime: number;
    }[]
  >(credential, 'GET', '/fapi/v2/balance');

export const postFApiV1Order = (
  credential: IAsterCredential,
  params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
    type:
      | 'MARKET'
      | 'LIMIT'
      | 'STOP'
      | 'STOP_MARKET'
      | 'TAKE_PROFIT'
      | 'TAKE_PROFIT_MARKET'
      | 'TRAILING_STOP_MARKET';
    reduceOnly?: 'true' | 'false';
    quantity?: number;
    price?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX' | 'HIDDEN';
  },
) => requestPerpetualPrivate(credential, 'POST', '/fapi/v1/order', params);

export const getFApiV1OpenOrders = (credential: IAsterCredential, params: { symbol?: string }) =>
  requestPerpetualPrivate<
    {
      orderId: number;
      clientOrderId: string;
      price: string;
      origQty: string;
      executedQty: string;
      status: string;
      timeInForce: string;
      type: string;
      side: 'BUY' | 'SELL';
      updateTime: number;
      avgPrice: string;
      reduceOnly?: boolean;
      closePosition?: boolean;
      positionSide?: 'BOTH' | 'LONG' | 'SHORT';
      workingType?: string;
      priceProtect?: boolean;
      origType?: string;
      stopPrice?: string;
      symbol: string;
    }[]
  >(credential, 'GET', '/fapi/v1/openOrders', params);

export const deleteFApiV1Order = (
  credential: IAsterCredential,
  params: { symbol: string; orderId?: string | number; origClientOrderId?: string },
) => requestPerpetualPrivate(credential, 'DELETE', '/fapi/v1/order', params);

export const getApiV1Account = (credential: IAsterCredential) =>
  requestSpotPrivate<
    {
      feeTier: number;
      canTrade: boolean;
      canDeposit: boolean;
      canWithdraw: boolean;
      canBurnAsset: boolean;
      updateTime: number;
      balances: { asset: string; free: string; locked: string }[];
    }
  >(credential, 'GET', '/api/v1/account');

export const postApiV1Order = (
  credential: IAsterCredential,
  params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
    timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
  },
) => requestSpotPrivate(credential, 'POST', '/api/v1/order', params);

export const getApiV1OpenOrders = (credential: IAsterCredential, params: { symbol?: string }) =>
  requestSpotPrivate<
    {
      symbol: string;
      orderId: number;
      clientOrderId: string;
      price: string;
      origQty: string;
      executedQty: string;
      status: string;
      timeInForce: string;
      type: string;
      side: 'BUY' | 'SELL';
      updateTime: number;
    }[]
  >(credential, 'GET', '/api/v1/openOrders', params);
