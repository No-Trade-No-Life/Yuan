import { IOrder } from '@yuants/data-order';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { ICredential, getCredentialId } from '../../api/types';
import { getUserOpenOrders } from '../../api/public-api';

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
const mapOrder = (order: any): IOrder => {
  const volume = Number(order.sz) || 0;
  const price = Number(order.limitPx) || 0;

  return {
    order_id: `${order.oid}`,
    account_id: '',
    product_id: encodePath('HYPERLIQUID', 'PERPETUAL', `${order.coin?.trim()}-USD`),
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
 * List perpetual orders
 */
export const listPerpOrders = async (credential: ICredential): Promise<IOrder[]> => {
  console.info(`[${formatTime(Date.now())}] Listing perpetual orders for ${credential.address}`);

  try {
    const orders = await getUserOpenOrders({ user: credential.address });
    return orders.map((order) => mapOrder(order));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${formatTime(Date.now())}] Failed to list perpetual orders: ${errorMessage}`);
    throw new Error(`Failed to list perpetual orders: ${errorMessage}`);
  }
};

/**
 * List orders by product_id
 */
export const listOrdersByProductId = async (
  credential: ICredential,
  product_id: string,
): Promise<IOrder[]> => {
  const [exchange, instType] = decodePath(product_id);
  if (exchange !== 'HYPERLIQUID') {
    throw new Error(`Invalid product_id for Hyperliquid: ${product_id}`);
  }
  if (instType !== 'PERPETUAL') {
    return [];
  }
  const orders = await listPerpOrders(credential);
  return orders.filter((order) => order.product_id === product_id);
};
