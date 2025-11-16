import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { getFApiV1OpenOrders, ICredential } from '../../api/private-api';
import { encodePath } from '@yuants/utils';

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

interface IAsterOpenOrder {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  reduceOnly?: boolean;
  closePosition?: boolean;
  type: string;
  origQty: string;
  executedQty: string;
  price: string;
  avgPrice: string;
  status: string;
  updateTime: number;
}

const resolveOrderDirection = (asterOrder: IAsterOpenOrder): OrderDirection => {
  const reduceOnly = asterOrder.reduceOnly || asterOrder.closePosition;

  if (asterOrder.positionSide === 'LONG') {
    return asterOrder.side === 'BUY' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (asterOrder.positionSide === 'SHORT') {
    return asterOrder.side === 'BUY' ? 'CLOSE_SHORT' : 'OPEN_SHORT';
  }
  if (reduceOnly) {
    return asterOrder.side === 'BUY' ? 'CLOSE_SHORT' : 'CLOSE_LONG';
  }
  return asterOrder.side === 'BUY' ? 'OPEN_LONG' : 'OPEN_SHORT';
};

export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  const orders = await getFApiV1OpenOrders(credential, {});
  return orders.map((order) => {
    const volume = Number(order.origQty);
    const tradedVolume = Number(order.executedQty);
    const price = Number(order.price);
    const avgPrice = Number(order.avgPrice);

    const mapped: IOrder = {
      order_id: `${order.orderId}`,
      account_id: account_id,
      product_id: encodePath('PERPETUAL', order.symbol),
      order_type: order.type,
      order_direction: resolveOrderDirection(order),
      volume: Number.isFinite(volume) ? volume : 0,
      price: Number.isFinite(price) ? price : undefined,
      submit_at: order.updateTime,
      traded_volume: Number.isFinite(tradedVolume) ? tradedVolume : undefined,
      traded_price: Number.isFinite(avgPrice) && avgPrice > 0 ? avgPrice : undefined,
      order_status: order.status,
    };

    return mapped;
  });
};
