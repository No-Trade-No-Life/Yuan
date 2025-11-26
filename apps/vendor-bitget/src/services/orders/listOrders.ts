import { IOrder } from '@yuants/data-order';
import { getFutureOrdersPending, getSpotOrdersPending } from '../../api/private-api';
import { ICredential } from '../../api/types';

export const listFuturesOrders = async (credential: ICredential): Promise<IOrder[]> => {
  // Future
  const res = await getFutureOrdersPending(credential, {
    productType: 'USDT-FUTURES',
  });
  if (res.msg !== 'success') {
    throw new Error(`Bitget list future orders failed: ${res.code} ${res.msg}`);
  }
  return (
    res.data.orderList?.map((v) => ({
      account_id: '',
      order_id: v.orderId,
      product_id: `BITGET/USDT-FUTURES/${v.symbol}`,
      order_type: v.orderType.toUpperCase(),
      order_direction:
        v.tradeSide === 'open'
          ? v.side === 'buy'
            ? 'OPEN_LONG'
            : 'OPEN_SHORT'
          : v.side === 'buy'
          ? 'CLOSE_SHORT'
          : 'CLOSE_LONG',
      price: Number(v.price),
      volume: Number(v.size),
      traded_volume: Number(v.filledQty),
      order_status: 'ACCEPTED',
      created_at: new Date(Number(v.cTime)).toISOString(),
      submit_at: Number(v.cTime),
    })) ?? []
  );
};

export const listSpotOrders = async (credential: ICredential): Promise<IOrder[]> => {
  // Spot
  const res = await getSpotOrdersPending(credential, {});
  if (res.msg !== 'success') {
    throw new Error(`Bitget list spot orders failed: ${res.code} ${res.msg}`);
  }
  return (
    res.data?.map((v) => ({
      account_id: '',
      order_id: v.orderId!,
      product_id: `BITGET/SPOT/${v.symbol}`,
      order_type: v.orderType?.toUpperCase(),
      order_direction: v.side === 'buy' ? 'OPEN_LONG' : 'CLOSE_LONG',
      price: Number(v.price),
      volume: Number(v.quantity),
      traded_volume: Number(v.filledQty),
      order_status: 'ACCEPTED',
      created_at: new Date(Number(v.cTime)).toISOString(),
      submit_at: Number(v.cTime),
    })) ?? []
  );
};
