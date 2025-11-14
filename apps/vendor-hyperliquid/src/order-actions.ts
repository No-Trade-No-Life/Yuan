import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { cancelOrder, placeOrder } from './api/private-api';
import { getDefaultCredential } from './api/types';
import { defaultPerpAccountId } from './account';
import { buildOrderPayload, resolveAssetInfo } from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'product_id', 'order_type', 'order_direction', 'volume'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'SubmitOrder', JSON.stringify(msg));
    const { orderParams } = await buildOrderPayload(msg.req);
    const params = { orders: [orderParams] };
    const res = await placeOrder(credential, params);
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

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    const order = msg.req;
    const assetId = (() => {
      if (order.comment) {
        try {
          const parsed = JSON.parse(order.comment);
          if (typeof parsed?.asset_id === 'number') {
            return parsed.asset_id;
          }
        } catch {
          // ignore
        }
      }
      return undefined;
    })();
    const resolvedAsset = assetId ?? (await resolveAssetInfo(order.product_id)).assetId;
    const orderId = Number(order.order_id);
    if (!Number.isFinite(orderId)) {
      throw new Error(`Invalid order_id: ${order.order_id}`);
    }
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
