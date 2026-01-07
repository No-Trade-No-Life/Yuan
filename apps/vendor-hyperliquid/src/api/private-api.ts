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

type OrderAction = {
  type: 'order';
  orders: OrderPayload[];
  grouping: 'na';
  builder?: { b: string; f: number };
};

type CancelAction = {
  type: 'cancel';
  cancels: CancelPayload[];
};

type ModifyAction = {
  type: 'modify';
  oid: number | string;
  order: OrderPayload;
};

type ExchangeAction = OrderAction | CancelAction | ModifyAction;

type L1Signature = { r: string; s: string; v: number };

const walletCache = new Map<string, Wallet>();

const getWallet = (credential: ICredential) => {
  if (!walletCache.has(credential.private_key)) {
    walletCache.set(credential.private_key, new Wallet(credential.private_key));
  }
  return walletCache.get(credential.private_key)!;
};

export const buildPlaceOrderAction = (params: {
  orders: OrderPayload[];
  builder?: { b: string; f: number };
}) => {
  const action: OrderAction = { type: 'order', orders: params.orders, grouping: 'na' };
  if (!params.builder) return action;
  return { ...action, builder: params.builder };
};

export const buildCancelOrderAction = (params: { cancels: CancelPayload[] }) =>
  ({
    type: 'cancel',
    cancels: params.cancels,
  } satisfies CancelAction);

export const buildModifyOrderAction = (params: { oid: number | string; order: OrderPayload }) =>
  ({
    type: 'modify',
    oid: params.oid,
    order: params.order,
  } satisfies ModifyAction);

export const createSignedExchangeRequestBody = async (
  credential: ICredential,
  action: ExchangeAction,
  options?: { nonce?: number; vaultAddress?: string; expiresAfter?: number; isMainnet?: boolean },
) => {
  const nonce = options?.nonce ?? Date.now();
  const signature: L1Signature = await signL1Action(
    getWallet(credential),
    action,
    options?.vaultAddress ?? null,
    nonce,
    options?.expiresAfter ?? null,
    options?.isMainnet ?? true,
  );
  return { action, nonce, signature };
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
  const action = buildPlaceOrderAction(params);
  const requestBody = await createSignedExchangeRequestBody(credential, action, {
    vaultAddress: params.vaultAddress,
    expiresAfter: params.expiresAfter,
  });
  return request('POST', 'exchange', requestBody);
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
  const action = buildCancelOrderAction(params);
  const requestBody = await createSignedExchangeRequestBody(credential, action, {
    vaultAddress: params.vaultAddress,
    expiresAfter: params.expiresAfter,
  });
  return request('POST', 'exchange', requestBody);
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
  const action = buildModifyOrderAction(params);
  const requestBody = await createSignedExchangeRequestBody(credential, action, {
    vaultAddress: params.vaultAddress,
    expiresAfter: params.expiresAfter,
  });
  return request('POST', 'exchange', requestBody);
};

export const buildUserFillsRequestBody = (
  credential: ICredential,
  params?: { startTime?: number; endTime?: number },
) => {
  const requestBody: { type: 'userFills'; user: string; startTime?: number; endTime?: number } = {
    type: 'userFills',
    user: credential.address,
  };

  if (params?.startTime != null) {
    requestBody.startTime = params.startTime;
  }

  if (params?.endTime != null) {
    requestBody.endTime = params.endTime;
  }

  return requestBody;
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
      crossChain: unknown;
    }[];
  }>('POST', 'info', buildUserFillsRequestBody(credential, params));
};
