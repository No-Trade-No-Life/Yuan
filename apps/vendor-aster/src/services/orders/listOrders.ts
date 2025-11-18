import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import {
  getApiV1OpenOrders,
  getFApiV1OpenOrders,
  IAsterFutureOpenOrder,
  IAsterSpotOpenOrder,
  ICredential,
} from '../../api/private-api';
import { encodePath } from '@yuants/utils';

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

const resolvePerpOrderDirection = (asterOrder: IAsterFutureOpenOrder): OrderDirection => {
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

const resolveSpotOrderDirection = (side: 'BUY' | 'SELL'): OrderDirection => {
  return side === 'SELL' ? 'CLOSE_LONG' : 'OPEN_LONG';
};

const mapPerpOrder = (order: IAsterFutureOpenOrder, account_id: string): IOrder => {
  const volume = Number(order.origQty);
  const tradedVolume = Number(order.executedQty);
  const price = Number(order.price);
  const avgPrice = Number(order.avgPrice);

  return {
    order_id: `${order.orderId}`,
    account_id,
    product_id: encodePath('PERPETUAL', order.symbol),
    order_type: order.type,
    order_direction: resolvePerpOrderDirection(order),
    volume: Number.isFinite(volume) ? volume : 0,
    price: Number.isFinite(price) ? price : undefined,
    submit_at: order.updateTime,
    traded_volume: Number.isFinite(tradedVolume) ? tradedVolume : undefined,
    traded_price: Number.isFinite(avgPrice) && avgPrice > 0 ? avgPrice : undefined,
    order_status: order.status,
  };
};

const mapSpotOrder = (order: IAsterSpotOpenOrder, account_id: string): IOrder => {
  const volume = Number(order.origQty);
  const tradedVolume = Number(order.executedQty);
  const price = Number(order.price);
  const avgPrice = Number(order.avgPrice ?? order.price);

  return {
    order_id: `${order.orderId}`,
    account_id,
    product_id: encodePath('SPOT', order.symbol),
    order_type: order.type,
    order_direction: resolveSpotOrderDirection(order.side),
    volume: Number.isFinite(volume) ? volume : 0,
    price: Number.isFinite(price) ? price : undefined,
    submit_at: order.updateTime ?? order.time,
    traded_volume: Number.isFinite(tradedVolume) ? tradedVolume : undefined,
    traded_price: Number.isFinite(avgPrice) && avgPrice > 0 ? avgPrice : undefined,
    order_status: order.status,
  };
};

const isSpotAccount = (account_id: string) => account_id.endsWith('/SPOT');

export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  if (isSpotAccount(account_id)) {
    const orders = await getApiV1OpenOrders(credential, {});
    return orders.map((order) => mapSpotOrder(order, account_id));
  }

  const orders = await getFApiV1OpenOrders(credential, {});
  return orders.map((order) => mapPerpOrder(order, account_id));
};
