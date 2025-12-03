import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { ICredential, getTradeOrdersPending } from '../api/private-api';

export const getOrders = async function (credential: ICredential): Promise<IOrder[]> {
  const orders: IOrder[] = [];
  const orderRes = await getTradeOrdersPending(credential, {});

  for (const x of orderRes.data || []) {
    const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';

    const order_direction =
      x.side === 'buy'
        ? x.posSide === 'long'
          ? 'OPEN_LONG'
          : 'CLOSE_SHORT'
        : x.posSide === 'short'
        ? 'OPEN_SHORT'
        : 'CLOSE_LONG';
    orders.push({
      order_id: x.ordId,
      account_id: '',
      product_id: encodePath('OKX', x.instType, x.instId),
      submit_at: +x.cTime,
      filled_at: +x.fillTime,
      order_type,
      order_direction,
      volume: +x.sz,
      traded_volume: +x.accFillSz,
      price: +x.px,
      traded_price: +x.avgPx,
    });
  }

  return orders;
};
