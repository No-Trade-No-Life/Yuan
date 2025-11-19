import { IOrder } from '@yuants/data-order';
import { ICredential } from '../../api/types';
import { resolveAssetInfo } from '../../utils';
import { cancelOrder } from '../../api/private-api';

export const cancelOrderAction = async (credential: ICredential, order: IOrder) => {
  const orderId = Number(order.order_id);
  if (!Number.isFinite(orderId)) {
    throw new Error(`Invalid order_id: ${order.order_id}`);
  }
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
  const res = await cancelOrder(credential, { cancels: [{ a: resolvedAsset, o: orderId }] });
  const status = res?.response?.data?.statuses;
  const error =
    res?.status !== 'ok'
      ? 'API ERROR'
      : Array.isArray(status) && typeof status[0] !== 'string'
      ? status[0]?.error
      : undefined;

  if (error) throw new Error(error);
};
