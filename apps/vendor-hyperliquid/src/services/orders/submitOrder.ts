import { IOrder } from '@yuants/data-order';
import { placeOrder } from '../../api/private-api';
import { ICredential } from '../../api/types';
import { buildOrderPayload } from '../../utils';

export const submitOrder = async (credential: ICredential, order: IOrder): Promise<{ order_id: string }> => {
  const { orderParams } = await buildOrderPayload(order);
  const res = await placeOrder(credential, { orders: [orderParams] });
  const status = res?.response?.data?.statuses?.[0];
  const orderId =
    status?.resting?.oid ?? status?.filled?.oid ?? (status as any)?.oid ?? (status as any)?.orderId;
  const error = res?.status !== 'ok' ? 'API ERROR' : status?.error ? status.error : undefined;
  if (error) throw new Error(error);
  if (orderId === undefined) throw new Error('No order ID returned from API');
  return { order_id: `${orderId}` };
};
