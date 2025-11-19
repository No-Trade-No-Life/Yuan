import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath, formatTime } from '@yuants/utils';
import { getUserOpenOrders, getUserPerpetualsAccountSummary, getUserTokenBalances } from '../api/public-api';
import { ICredential, getAddressFromCredential } from '../api/types';

/**
 * Get account info for perpetual account
 */
const getPerpAccountInfo = async (credential: ICredential, account_id: string) => {
  console.info(`[${formatTime(Date.now())}] Getting perp account info for ${account_id}`);

  const summary = await getUserPerpetualsAccountSummary({ user: getAddressFromCredential(credential) });
  const orders = await getUserOpenOrders({ user: getAddressFromCredential(credential) });

  // Map positions
  const positions = summary.assetPositions.map((position) => ({
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
  }));

  // Map orders
  const mapOrderDirection = (side: string) => {
    const normalized = side.toUpperCase();
    if (normalized === 'BID' || normalized === 'BUY') {
      return 'OPEN_LONG';
    }
    if (normalized === 'ASK' || normalized === 'SELL') {
      return 'OPEN_SHORT';
    }
    return 'OPEN_LONG';
  };

  const pending_orders = orders.map((order) => ({
    order_id: `${order.oid}`,
    account_id,
    product_id: encodePath('PERPETUAL', `${order.coin?.trim()}-USD`),
    order_type: 'LIMIT',
    order_direction: mapOrderDirection(order.side),
    volume: Number(order.sz) || 0,
    price: Number(order.limitPx) || undefined,
    submit_at: Number(order.timestamp ?? Date.now()),
  }));

  return {
    money: {
      currency: 'USDC',
      equity: +summary.crossMarginSummary.accountValue,
      free: +summary.withdrawable,
    },
    positions,
    pending_orders,
  };
};

/**
 * Get account info for spot account
 */
const getSpotAccountInfo = async (credential: ICredential, account_id: string) => {
  console.info(`[${formatTime(Date.now())}] Getting spot account info for ${account_id}`);

  const balances = await getUserTokenBalances({ user: getAddressFromCredential(credential) });

  // Map token balances to positions (using spot as "positions")
  const positions = balances.balances
    .filter((balance: any) => Number(balance.total) > 0)
    .map((balance: any) => ({
      position_id: `${balance.coin}`,
      datasource_id: 'HYPERLIQUID',
      product_id: encodePath('SPOT', `${balance.coin}-USDC`),
      direction: 'LONG',
      volume: Number(balance.total),
      free_volume: Number(balance.total) - Number(balance.hold),
      position_price: 1, // USDC as quote currency
      closable_price: 1,
      floating_profit: 0,
      valuation: Number(balance.total),
      margin: 0,
    }));

  return {
    money: {
      currency: 'USDC',
      equity: positions.reduce((sum: number, pos: any) => sum + pos.valuation, 0),
      free: positions.reduce((sum: number, pos: any) => sum + pos.free_volume, 0),
    },
    positions,
    pending_orders: [], // Spot orders would need separate API call
  };
};

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'HYPERLIQUID',
  {
    type: 'object',
    required: ['private_key'],
    properties: {
      private_key: { type: 'string' },
    },
  },
  {
    listAccounts: async (credential) => {
      console.info(
        `[${formatTime(Date.now())}] Listing accounts for ${getAddressFromCredential(credential)}`,
      );
      return [
        {
          account_id: `hyperliquid/${getAddressFromCredential(credential)}/perp/USDC`,
        },
        {
          account_id: `hyperliquid/${getAddressFromCredential(credential)}/spot/USDC`,
        },
      ];
    },
    getAccountInfo: async (credential, account_id) => {
      console.info(`[${formatTime(Date.now())}] Getting account info for ${account_id}`);

      if (account_id.endsWith('/perp/USDC')) {
        return getPerpAccountInfo(credential, account_id);
      }
      if (account_id.endsWith('/spot/USDC')) {
        return getSpotAccountInfo(credential, account_id);
      }
      throw new Error(`Unsupported account type for account_id: ${account_id}`);
    },
  },
);
