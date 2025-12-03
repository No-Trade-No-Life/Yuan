import { IOrder } from '@yuants/data-order';
import { getUnfilledOrders } from '../../api/private-api';
import { ICredential } from '../../api/types';

export const listFuturesOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getUnfilledOrders(credential, { category: 'USDT-FUTURES' });
  if (res.msg !== 'success') {
    throw new Error(`Bitget list future orders failed: ${res.code} ${res.msg}`);
  }
  return (
    res.data.list?.map((v) => ({
      account_id: '',
      order_id: v.orderId,
      product_id: `BITGET/USDT-FUTURES/${v.symbol}`,
      order_type: v.orderType?.toUpperCase(),
      order_direction:
        v.posSide === 'long'
          ? v.side === 'buy'
            ? 'OPEN_LONG'
            : 'CLOSE_LONG'
          : v.side === 'buy'
          ? 'CLOSE_SHORT'
          : 'OPEN_SHORT',
      price: Number(v.price),
      volume: Number(v.qty),
      traded_volume: Number(v.cumExecQty),
      order_status: 'ACCEPTED',
      created_at: new Date(Number(v.createdTime)).toISOString(),
      submit_at: Number(v.createdTime),
    })) ?? []
  );
};

export const listSpotOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getUnfilledOrders(credential, { category: 'SPOT' });
  if (res.msg !== 'success') {
    throw new Error(`Bitget list spot orders failed: ${res.code} ${res.msg}`);
  }
  return (
    res.data?.list?.map((v) => ({
      account_id: '',
      order_id: v.orderId!,
      product_id: `BITGET/SPOT/${v.symbol}`,
      order_type: v.orderType?.toUpperCase(),
      order_direction: v.side === 'buy' ? 'OPEN_LONG' : 'CLOSE_LONG',
      price: Number(v.price),
      volume: Number(v.qty),
      traded_volume: Number(v.cumExecQty),
      order_status: 'ACCEPTED',
      created_at: new Date(Number(v.createdTime)).toISOString(),
      submit_at: Number(v.createdTime),
    })) ?? []
  );
};
