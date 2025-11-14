import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer } from 'rxjs';
import { getFApiV1OpenOrders, getApiV1OpenOrders } from './api/private-api';
import { getDefaultCredential } from './api/client';
import { getPerpetualAccountId, getSpotAccountId } from './account-profile';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

interface IAsterPerpOpenOrder {
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

interface IAsterSpotOpenOrder {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  origQty: string;
  executedQty: string;
  price: string;
  status: string;
  updateTime: number;
}

const resolvePerpOrderDirection = (asterOrder: IAsterPerpOpenOrder): OrderDirection => {
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

const mapPerpOrder = (order: IAsterPerpOpenOrder, accountId: string): IOrder => {
  const volume = Number(order.origQty);
  const tradedVolume = Number(order.executedQty);
  const price = Number(order.price);
  const avgPrice = Number(order.avgPrice);

  return {
    order_id: `${order.orderId}`,
    account_id: accountId,
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

const mapSpotOrderDirection = (side: 'BUY' | 'SELL'): OrderDirection => (side === 'BUY' ? 'OPEN_LONG' : 'OPEN_SHORT');

const mapSpotOrder = (order: IAsterSpotOpenOrder, accountId: string): IOrder => {
  const volume = Number(order.origQty);
  const tradedVolume = Number(order.executedQty);
  const price = Number(order.price);
  return {
    order_id: `${order.orderId}`,
    account_id: accountId,
    product_id: encodePath('SPOT', order.symbol),
    order_type: order.type,
    order_direction: mapSpotOrderDirection(order.side),
    volume: Number.isFinite(volume) ? volume : 0,
    price: Number.isFinite(price) ? price : undefined,
    submit_at: order.updateTime,
    traded_volume: Number.isFinite(tradedVolume) ? tradedVolume : undefined,
    order_status: order.status,
  };
};

defer(async () => {
  const accountId = await getPerpetualAccountId();
  providePendingOrdersService(
    terminal,
    accountId,
    async () => {
      const orders = (await getFApiV1OpenOrders(credential, {})) as IAsterPerpOpenOrder[];
      return orders.map((order) => mapPerpOrder(order, accountId));
    },
    { auto_refresh_interval: 2000 },
  );
}).subscribe();

defer(async () => {
  const accountId = await getSpotAccountId();
  providePendingOrdersService(
    terminal,
    accountId,
    async () => {
      const orders = (await getApiV1OpenOrders(credential, {})) as IAsterSpotOpenOrder[];
      return orders.map((order) => mapSpotOrder(order, accountId));
    },
    { auto_refresh_interval: 5000 },
  );
}).subscribe();
