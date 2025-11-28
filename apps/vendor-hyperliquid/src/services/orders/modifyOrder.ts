import { IOrder } from '@yuants/data-order';
import { formatTime } from '@yuants/utils';
import { ICredential } from '../../api/types';
import { modifyOrder as modifyOrderApi } from '../../api/private-api';
import { buildOrderPayload } from '../utils';

/**
 * 修改订单 - 使用 Hyperliquid 原生 modify order API
 *
 * Hyperliquid supports native order modification through the modify action:
 * https://hyperliquid.gitbook.io/hyperliquid-docs/for-develope../../api/exchange-endpoint#modify-an-order
 *
 * This is more efficient than cancel + place new as it:
 * 1. Maintains order priority in the order book
 * 2. Reduces API calls from 2 to 1
 * 3. Prevents race conditions where the cancelled order might be filled before new order is placed
 */
export const modifyOrder = async (credential: ICredential, order: IOrder): Promise<void> => {
  console.info(`[${formatTime(Date.now())}] Modifying order ${order.order_id} for ${order.product_id}`);

  try {
    // Validate order_id
    const orderId = Number(order.order_id);
    if (!Number.isFinite(orderId)) {
      throw new Error(`Invalid order_id: ${order.order_id}`);
    }

    // Build the new order payload with updated parameters
    const { orderParams } = await buildOrderPayload(order);

    console.info(`[${formatTime(Date.now())}] Modifying order ${order.order_id} with new params:`, {
      asset: orderParams.a,
      isBuy: orderParams.b,
      price: orderParams.p,
      size: orderParams.s,
      reduceOnly: orderParams.r,
      tif: orderParams.t.limit?.tif,
    });

    // Call Hyperliquid's native modify order API
    const result = await modifyOrderApi(credential, {
      oid: orderId,
      order: orderParams,
    });

    // Check if the modification was successful
    const status = result?.response?.data?.statuses?.[0];
    const error = result?.status !== 'ok' ? 'API ERROR' : status?.error ? status.error : undefined;

    if (error) {
      throw new Error(`Failed to modify order: ${error}`);
    }

    console.info(`[${formatTime(Date.now())}] Order ${order.order_id} modified successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${formatTime(Date.now())}] Failed to modify order ${order.order_id}: ${errorMessage}`);
    throw new Error(`Failed to modify order: ${errorMessage}`);
  }
};
