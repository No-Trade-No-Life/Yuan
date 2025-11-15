import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getUserOpenOrders, getUserPerpetualsAccountSummary } from './api/public-api';
import { getDefaultCredential } from './api/types';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();
const walletAddress = credential.address.toLowerCase();
export const defaultPerpAccountId = `hyperliquid/${walletAddress}/perp/USDC`;

addAccountMarket(terminal, { account_id: defaultPerpAccountId, market_id: 'HYPERLIQUID/PERP' });

const mapPosition = (position: any): IPosition => ({
  position_id: `${position.position.coin}-USD`,
  datasource_id: 'HYPERLIQUID',
  product_id: encodePath('PERPETUAL', `${position.position.coin}-USD`),
  direction: +position.position.szi > 0 ? 'LONG' : 'SHORT',
  volume: Math.abs(+position.position.szi),
  free_volume: Math.abs(+position.position.szi),
  position_price: +position.position.entryPx,
  closable_price: Math.abs(+position.position.positionValue / +position.position.szi || 0),
  floating_profit: +position.position.unrealizedPnl,
  valuation: +position.position.positionValue,
  margin: +position.position.marginUsed,
});

provideAccountInfoService(
  terminal,
  defaultPerpAccountId,
  async () => {
    const summary = await getUserPerpetualsAccountSummary({ user: credential.address });
    return {
      money: {
        currency: 'USDC',
        equity: +summary.crossMarginSummary.accountValue,
        free: +summary.withdrawable,
      },
      positions: summary.assetPositions.map(mapPosition),
    };
  },
  { auto_refresh_interval: 1000 },
);

const mapOrderDirection = (side: string): IOrder['order_direction'] => {
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
  defaultPerpAccountId,
  async () => {
    const orders = await getUserOpenOrders({ user: credential.address });
    return orders.map(
      (order): IOrder => ({
        order_id: `${order.oid}`,
        account_id: defaultPerpAccountId,
        product_id: encodePath('PERPETUAL', `${order.coin?.trim()}-USD`),
        order_type: 'LIMIT',
        order_direction: mapOrderDirection(order.side),
        volume: Number(order.sz) || 0,
        price: Number(order.limitPx) || undefined,
        submit_at: Number(order.timestamp ?? Date.now()),
      }),
    );
  },
  { auto_refresh_interval: 2000 },
);
