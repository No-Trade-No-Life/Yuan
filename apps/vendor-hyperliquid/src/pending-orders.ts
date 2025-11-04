import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

if (!client.public_key) {
  throw new Error('Hyperliquid client requires PRIVATE_KEY to fetch pending orders');
}

const accountId = `Hyperliquid/${client.public_key}`;

type OpenOrder = Awaited<ReturnType<typeof client.getUserOpenOrders>>[number];

const resolveDirection = (side: string): IOrder['order_direction'] => {
  const normalized = side.toUpperCase();
  if (normalized === 'BID' || normalized === 'BUY') {
    return 'OPEN_LONG';
  }
  if (normalized === 'ASK' || normalized === 'SELL') {
    return 'OPEN_SHORT';
  }
  return 'OPEN_LONG';
};

providePendingOrdersService(
  terminal,
  accountId,
  async () => {
    const openOrders = await client.getUserOpenOrders({ user: client.public_key! });

    return openOrders
      .map((order: OpenOrder) => {
        const coin = order.coin?.trim();
        const orderId = order.oid;
        const price = Number(order.limitPx);
        const volume = Number(order.sz);
        const submitAt = Number(order.timestamp ?? Date.now());

        const mapped: IOrder = {
          order_id: `${orderId}`,
          account_id: accountId,
          product_id: encodePath('PERPETUAL', `${coin}-USD`),
          order_type: 'LIMIT',
          order_direction: resolveDirection(order.side),
          volume: Number.isFinite(volume) ? volume : 0,
          price: Number.isFinite(price) ? price : undefined,
          submit_at: Number.isFinite(submitAt) ? submitAt : undefined,
        };

        return mapped;
      })
      .filter((order): order is IOrder => !!order);
  },
  { auto_refresh_interval: 2000 },
);
