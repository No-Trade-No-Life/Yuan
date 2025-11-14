import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { cancelOrder, placeOrder } from './api/private-api';
import { createCredential } from './api/types';
import { buildOrderPayload, resolveAssetInfo } from './order-utils';

interface IRequestCredential {
  private_key: string;
}

const terminal = Terminal.fromNodeEnv();

const normalizeAccountId = (accountId: string) => accountId.trim().toLowerCase();

const ensureAccountMatchesCredential = (accountId: string, credential: ReturnType<typeof createCredential>) => {
  const normalized = normalizeAccountId(accountId);
  if (!normalized.startsWith('hyperliquid/')) {
    throw new Error('account_id must start with hyperliquid/');
  }
  const expected = `hyperliquid/${credential.address.toLowerCase()}/perp/usdc`;
  if (normalized !== expected) {
    throw new Error('account_id does not match credential address or scope');
  }
};

type SubmitOrderRequest = IOrder & { credential: IRequestCredential };

terminal.server.provideService<SubmitOrderRequest, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: { type: 'string', pattern: '^hyperliquid/' },
      credential: {
        type: 'object',
        required: ['private_key'],
        properties: { private_key: { type: 'string' } },
      },
    },
  },
  async (msg) => {
    const credential = createCredential(msg.req.credential.private_key);
    ensureAccountMatchesCredential(msg.req.account_id, credential);
    const { orderParams } = await buildOrderPayload(msg.req);
    const res = await placeOrder(credential, { orders: [orderParams] });
    const status = res?.response?.data?.statuses?.[0];
    const orderId =
      status?.resting?.oid ?? status?.filled?.oid ?? (status as any)?.oid ?? (status as any)?.orderId;
    const error =
      res?.status !== 'ok'
        ? 'API ERROR'
        : status?.error
        ? status.error
        : undefined;
    return {
      res: {
        code: error ? 1 : 0,
        message: error || 'OK',
        data: orderId !== undefined ? { order_id: `${orderId}` } : undefined,
      },
    };
  },
);

type CancelOrderRequest = IOrder & { credential: IRequestCredential };

terminal.server.provideService<CancelOrderRequest>(
  'CancelOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: { type: 'string', pattern: '^hyperliquid/' },
      credential: {
        type: 'object',
        required: ['private_key'],
        properties: { private_key: { type: 'string' } },
      },
    },
  },
  async (msg) => {
    const credential = createCredential(msg.req.credential.private_key);
    ensureAccountMatchesCredential(msg.req.account_id, credential);
    const orderId = Number(msg.req.order_id);
    if (!Number.isFinite(orderId)) {
      throw new Error(`Invalid order_id: ${msg.req.order_id}`);
    }
    const assetId = (() => {
      if (msg.req.comment) {
        try {
          const parsed = JSON.parse(msg.req.comment);
          if (typeof parsed?.asset_id === 'number') {
            return parsed.asset_id;
          }
        } catch {
          // ignore
        }
      }
      return undefined;
    })();
    const resolvedAsset = assetId ?? (await resolveAssetInfo(msg.req.product_id)).assetId;
    const res = await cancelOrder(credential, { cancels: [{ a: resolvedAsset, o: orderId }] });
    const status = res?.response?.data?.statuses;
    const error =
      res?.status !== 'ok'
        ? 'API ERROR'
        : Array.isArray(status) && typeof status[0] !== 'string'
        ? status[0]?.error
        : undefined;
    return {
      res: {
        code: error ? 1 : 0,
        message: error || 'OK',
      },
    };
  },
);
