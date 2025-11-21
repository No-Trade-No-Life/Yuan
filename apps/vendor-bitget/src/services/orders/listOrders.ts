import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { getFutureOrdersPending, getSpotOrdersPending, type ICredential } from '../../api/private-api';

export const listOrders = async (credential: ICredential, account_id: string): Promise<IOrder[]> => {
  if (account_id.endsWith('/futures/USDT')) {
    // Future
    // bitget/<uid>/futures/USDT
    const res = await getFutureOrdersPending(credential, {
      productType: 'USDT-FUTURES',
    });
    if (res.msg !== 'success') {
      throw new Error(`Bitget list future orders failed: ${res.code} ${res.msg}`);
    }
    return (
      res.data.orderList?.map((v) => ({
        account_id,
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
  }

  if (account_id.endsWith('/spot/USDT')) {
    // Spot
    // bitget/<uid>/spot/USDT
    const res = await getSpotOrdersPending(credential, {});
    if (res.msg !== 'success') {
      throw new Error(`Bitget list spot orders failed: ${res.code} ${res.msg}`);
    }
    return (
      res.data?.map((v) => ({
        account_id,
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
  }

  throw new Error(`Unsupported account_id: ${account_id}`);
};
