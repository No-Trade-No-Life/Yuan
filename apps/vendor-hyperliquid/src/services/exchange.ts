import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { ICredential, getCredentialId as getCredentialIdFromCredential } from '../api/types';
import { listProducts } from './markets/product';
import { getPerpPositions } from './accounts/perp';
import { getSpotPositions } from './accounts/spot';
import { cancelOrderAction } from './orders/cancelOrder';
import { listOrdersByProductId, listPerpOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

const ensureHyperliquidProduct = (product_id?: string) => {
  if (!product_id) {
    throw new Error('product_id is required');
  }
  const [exchange, instType] = decodePath(product_id);
  if (exchange !== 'HYPERLIQUID') {
    throw new Error(`product_id must start with HYPERLIQUID, got ${product_id}`);
  }
  if (instType !== 'PERPETUAL') {
    throw new Error(`Hyperliquid only supports PERPETUAL orders for now: ${product_id}`);
  }
};

provideExchangeServices<ICredential>(terminal, {
  name: 'HYPERLIQUID',
  credentialSchema: {
    type: 'object',
    required: ['private_key', 'address'],
    properties: {
      private_key: { type: 'string' },
      address: { type: 'string' },
    },
  },
  getCredentialId: async (credential) => getCredentialIdFromCredential(credential),
  listProducts,
  getPositions: async (credential: ICredential): Promise<IPosition[]> => {
    console.info(
      `[${formatTime(Date.now())}] Fetching positions for ${getCredentialIdFromCredential(credential)}`,
    );
    const [perpPositions, spotPositions] = await Promise.all([
      getPerpPositions(credential),
      getSpotPositions(credential),
    ]);
    return [...perpPositions, ...spotPositions];
  },
  getPositionsByProductId: async (credential: ICredential, product_id: string): Promise<IPosition[]> => {
    const [exchange, instType] = decodePath(product_id);
    if (exchange !== 'HYPERLIQUID') {
      throw new Error(`Invalid product_id for Hyperliquid: ${product_id}`);
    }
    if (instType === 'PERPETUAL') {
      const perpPositions = await getPerpPositions(credential);
      return perpPositions.filter((position) => position.product_id === product_id);
    }
    if (instType === 'PERPETUAL-ASSET') {
      const perpPositions = await getPerpPositions(credential);
      return perpPositions.filter((position) => position.product_id === product_id);
    }
    if (instType === 'SPOT') {
      const spotPositions = await getSpotPositions(credential);
      return spotPositions.filter((position) => position.product_id === product_id);
    }
    return [];
  },
  getOrders: async (credential: ICredential): Promise<IOrder[]> => {
    return listPerpOrders(credential);
  },
  getOrdersByProductId: async (credential: ICredential, product_id: string): Promise<IOrder[]> => {
    return listOrdersByProductId(credential, product_id);
  },
  submitOrder: async (credential: ICredential, order: IOrder): Promise<{ order_id: string }> => {
    ensureHyperliquidProduct(order.product_id);
    return submitOrder(credential, order);
  },
  modifyOrder: async (credential: ICredential, order: IOrder): Promise<void> => {
    ensureHyperliquidProduct(order.product_id);
    return modifyOrder(credential, order);
  },
  cancelOrder: async (credential: ICredential, order: IOrder): Promise<void> => {
    ensureHyperliquidProduct(order.product_id);
    return cancelOrderAction(credential, order);
  },
});
