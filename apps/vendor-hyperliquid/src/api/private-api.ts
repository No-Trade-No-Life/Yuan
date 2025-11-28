import { Wallet } from 'ethers';
import { signL1Action } from './sign';
import { request } from './client';
import { ICredential } from './types';

/**
 * Order payload for placing orders on Hyperliquid
 */
type OrderPayload = {
  /** Asset index (absolute) */
  a: number;
  /** Buy flag (true for buy, false for sell) */
  b: boolean;
  /** Limit price string */
  p: string;
  /** Size string */
  s: string;
  /** Reduce only flag */
  r: boolean;
  /** Order type configuration */
  t: {
    /** Time in force for limit orders: "Alo" (Post-Only), "Ioc" (Immediate or Cancel), "Gtc" (Good til Cancel) */
    limit?: { tif: string };
    /** Trigger order configuration */
    trigger?: {
      /** Is market trigger price */
      isMarket: boolean;
      /** Trigger price string */
      triggerPx: string;
      /** Take profit/stop loss indicator */
      tpsl: string;
    };
  };
  /** Order fee coefficient */
  c?: number;
};

/**
 * Cancel order payload
 */
type CancelPayload = {
  /** Asset index (absolute) */
  a: number;
  /** Order ID */
  o: number;
};

/**
 * Modify order payload
 */
type ModifyOrderPayload = {
  /** Order ID to modify */
  oid: number | string;
  /** New order parameters */
  order: OrderPayload;
};

const walletCache = new Map<string, Wallet>();

const getWallet = (credential: ICredential) => {
  if (!walletCache.has(credential.private_key)) {
    walletCache.set(credential.private_key, new Wallet(credential.private_key));
  }
  return walletCache.get(credential.private_key)!;
};

/**
 * Place orders on Hyperliquid exchange
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#place-an-order
 * API Endpoint: POST /exchange
 * @param credential - User credential containing private key for signing
 * @param params - Order placement parameters
 * @returns Promise resolving to exchange response
 */
export const placeOrder = async (
  credential: ICredential,
  params: {
    orders: OrderPayload[];
    builder?: { b: string; f: number };
    vaultAddress?: string;
    expiresAfter?: number;
  },
) => {
  const action: Record<string, any> = {
    type: 'order',
    orders: params.orders,
    grouping: 'na',
  };
  if (params.builder) {
    action['builder'] = params.builder;
  }
  const nonce = Date.now();
  const signature = await signL1Action(
    getWallet(credential),
    action,
    params.vaultAddress ?? null,
    nonce,
    params.expiresAfter ?? null,
    true,
  );
  return request('POST', 'exchange', { action, nonce, signature });
};

/**
 * Cancel orders on Hyperliquid exchange
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint#cancel-order-s
 * API Endpoint: POST /exchange
 * @param credential - User credential containing private key for signing
 * @param params - Order cancellation parameters
 * @returns Promise resolving to exchange response
 */
export const cancelOrder = async (
  credential: ICredential,
  params: { cancels: CancelPayload[]; vaultAddress?: string; expiresAfter?: number },
) => {
  const action: Record<string, any> = {
    type: 'cancel',
    cancels: params.cancels,
  };
  const nonce = Date.now();
  const signature = await signL1Action(
    getWallet(credential),
    action,
    params.vaultAddress ?? null,
    nonce,
    params.expiresAfter ?? null,
    true,
  );
  return request('POST', 'exchange', { action, nonce, signature });
};

/**
 * Modify an existing order on Hyperliquid exchange
 * API Endpoint: POST /exchange
 * @param credential - User credential containing private key for signing
 * @param params - Order modification parameters
 * @returns Promise resolving to exchange response
 */
export const modifyOrder = async (
  credential: ICredential,
  params: {
    oid: number | string;
    order: OrderPayload;
    vaultAddress?: string;
    expiresAfter?: number;
  },
) => {
  const action: Record<string, any> = {
    type: 'modify',
    oid: params.oid,
    order: params.order,
  };
  const nonce = Date.now();
  const signature = await signL1Action(
    getWallet(credential),
    action,
    params.vaultAddress ?? null,
    nonce,
    params.expiresAfter ?? null,
    true,
  );
  return request('POST', 'exchange', { action, nonce, signature });
};

/**
 * Get user's fill history (trade history) from Hyperliquid
 * API Endpoint: POST /info (type: userFills)
 * @param credential - User credential containing private key for authentication
 * @param params - Optional time range parameters
 * @returns Promise resolving to user fill history with detailed trade information
 */
export const getUserFills = async (
  credential: ICredential,
  params?: { startTime?: number; endTime?: number },
) => {
  const wallet = getWallet(credential);
  const address = wallet.address;

  const requestBody: any = {
    type: 'userFills',
    user: address,
  };

  if (params?.startTime) {
    requestBody.startTime = params.startTime;
  }

  if (params?.endTime) {
    requestBody.endTime = params.endTime;
  }

  return request<{
    fills: {
      time: number;
      feedId: string;
      hash: string;
      coin: string;
      side: string;
      px: string;
      sz: string;
      oid: number;
      startPos: string;
      fee: string;
      feeToken: string;
      closedSize: string;
      closedPnl: string;
      dir: string;
      source: string;
      type: string;
      positionAction: string;
      asset: number;
      tid: string;
      crossChain: any;
    }[];
  }>('POST', 'info', requestBody);
};
