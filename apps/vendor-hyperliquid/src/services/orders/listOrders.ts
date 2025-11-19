import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { ICredential, getAddressFromCredential } from '../../api/types';
import { getUserOpenOrders, getUserTokenBalances } from '../../api/public-api';
import { encodePath } from '@yuants/utils';
import { formatTime } from '@yuants/utils';

type OrderDirection = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';

/**
 * Map order direction based on side and reduce-only logic
 */
const mapOrderDirection = (side: string): OrderDirection => {
  const normalized = side.toUpperCase();
  if (normalized === 'BID' || normalized === 'BUY') {
    return 'OPEN_LONG';
  }
  if (normalized === 'ASK' || normalized === 'SELL') {
    return 'OPEN_SHORT';
  }
  return 'OPEN_LONG';
};

/**
 * Map Hyperliquid order to Yuan IOrder format
 */
const mapOrder = (order: any, account_id: string): IOrder => {
  const volume = Number(order.sz) || 0;
  const price = Number(order.limitPx) || 0;

  return {
    order_id: `${order.oid}`,
    account_id,
    product_id: encodePath('PERPETUAL', `${order.coin?.trim()}-USD`),
    order_type: 'LIMIT', // Hyperliquid primarily uses limit orders
    order_direction: mapOrderDirection(order.side),
    volume: Number.isFinite(volume) ? volume : 0,
    price: Number.isFinite(price) && price > 0 ? price : undefined,
    submit_at: Number(order.timestamp ?? Date.now()),
    order_status: 'open', // Since these are open orders
    // Additional fields that might be useful
    comment: order.coin ? JSON.stringify({ asset_id: order.coin }) : undefined,
  };
};

/**
 * Check if account is spot account
 */
const isSpotAccount = (account_id: string) => account_id.endsWith('/spot/USDC');

/**
 * List spot orders (currently no dedicated API, so return empty)
 * Note: Hyperliquid doesn't seem to have a separate spot orders API in the current documentation
 * This would need to be implemented when spot trading APIs become available
 */
const listSpotOrders = async (credential: ICredential, account_id: string): Promise<IOrder[]> => {
  console.info(`[${formatTime(Date.now())}] Listing spot orders for ${account_id}`);

  // For now, return empty array as spot orders are not supported via current API
  // This would need to be implemented when Hyperliquid provides spot orders API
  console.warn(`[${formatTime(Date.now())}] Spot orders not yet supported via Hyperliquid API`);

  return [];
};

/**
 * List perpetual orders
 */
const listPerpOrders = async (credential: ICredential, account_id: string): Promise<IOrder[]> => {
  console.info(`[${formatTime(Date.now())}] Listing perpetual orders for ${account_id}`);

  try {
    const orders = await getUserOpenOrders({ user: getAddressFromCredential(credential) });
    return orders.map((order) => mapOrder(order, account_id));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${formatTime(Date.now())}] Failed to list perpetual orders: ${errorMessage}`);
    throw new Error(`Failed to list perpetual orders: ${errorMessage}`);
  }
};

/**
 * List orders implementation
 */
export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  console.info(`[${formatTime(Date.now())}] Listing orders for account: ${account_id}`);

  try {
    if (isSpotAccount(account_id)) {
      return await listSpotOrders(credential, account_id);
    }

    return await listPerpOrders(credential, account_id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${formatTime(Date.now())}] Failed to list orders for ${account_id}: ${errorMessage}`);
    throw new Error(`Failed to list orders: ${errorMessage}`);
  }
};
