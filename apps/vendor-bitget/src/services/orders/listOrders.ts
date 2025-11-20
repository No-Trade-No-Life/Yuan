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
        client_order_id: v.clientOid,
        product_id: `BITGET/USDT-FUTURES/${v.symbol}`,
        type: 'LIMIT', // Bitget pending orders are mostly LIMIT or STOP
        side: v.side === 'buy' ? 'LONG' : 'SHORT', // Simplified mapping
        price: Number(v.price),
        volume: Number(v.size),
        traded_volume: Number(v.filledQty),
        status: 'ACCEPTED',
        timestamp: Number(v.cTime),
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
        client_order_id: v.clientOid,
        product_id: `BITGET/SPOT/${v.symbol}`,
        type: 'LIMIT',
        side: v.side === 'buy' ? 'LONG' : 'SHORT',
        price: Number(v.price),
        volume: Number(v.quantity), // Spot quantity is base currency for buy/sell limit
        traded_volume: Number(v.filledQty), // Spot filled quantity
        status: 'ACCEPTED',
        timestamp: Number(v.cTime),
      })) ?? []
    );
  }

  throw new Error(`Unsupported account_id: ${account_id}`);
};
