import { Wallet } from 'ethers';
import { signL1Action } from '../sign';
import { request } from './client';
import { ICredential } from './types';

type OrderPayload = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: {
    limit?: { tif: string };
    trigger?: {
      isMarke: boolean;
      triggerPx: string;
      tpsl: string;
    };
  };
  c?: number;
};

type CancelPayload = {
  a: number;
  o: number;
};

const walletCache = new Map<string, Wallet>();

const getWallet = (credential: ICredential) => {
  if (!walletCache.has(credential.private_key)) {
    walletCache.set(credential.private_key, new Wallet(credential.private_key));
  }
  return walletCache.get(credential.private_key)!;
};

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
