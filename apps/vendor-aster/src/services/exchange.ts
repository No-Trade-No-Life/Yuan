import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { listProducts } from './markets/product';
import { getCredentialId } from './accounts/profile';
import { getSpotAccountInfo } from './accounts/spot';
import { listOrders, listPrepOrders, listSpotOrders } from './orders/listOrders';
import { handleSubmitOrder } from './orders/submitOrder';
import { ICredential } from '../api/private-api';
import { getPerpAccountInfo } from './accounts/perp';
import { handleCancelOrder } from './orders/cancelOrder';

const terminal = Terminal.fromNodeEnv();

provideExchangeServices<ICredential>(terminal, {
  name: 'ASTER',
  credentialSchema: {
    type: 'object',
    required: ['address', 'secret_key', 'api_key'],
    properties: {
      address: { type: 'string' },
      secret_key: { type: 'string' },
      api_key: { type: 'string' },
    },
  },
  getCredentialId,
  listProducts,
  getPositions: async function (credential: ICredential): Promise<IPosition[]> {
    const [perpPositions, spotPositions] = await Promise.all([
      getPerpAccountInfo(credential),
      getSpotAccountInfo(credential),
    ]);
    return [...perpPositions, ...spotPositions];
  },
  getOrders: listOrders,
  getPositionsByProductId: async function (
    credential: ICredential,
    product_id: string,
  ): Promise<IPosition[]> {
    const [_, instType] = decodePath(product_id); // ASTER/PERP/ADAUSDT
    if (instType === 'SPOT') {
      const positions = await getSpotAccountInfo(credential);
      return positions.filter((position) => position.product_id === product_id);
    }
    if (instType === 'PERP') {
      const positions = await getPerpAccountInfo(credential);
      return positions.filter((position) => position.product_id === product_id);
    }
    throw new Error(`Unsupported instType: ${instType}`);
  },
  getOrdersByProductId: async function (credential: ICredential, product_id: string): Promise<IOrder[]> {
    const [_, instType] = decodePath(product_id); // BITGET/USDT-FUTURES/BTCUSDT
    if (instType === 'SPOT') {
      const orders = await listSpotOrders(credential);
      return orders.filter((order) => order.product_id === product_id);
    }
    if (instType === 'PERP') {
      const orders = await listPrepOrders(credential);
      return orders.filter((order) => order.product_id === product_id);
    }
    throw new Error(`Unsupported instType: ${instType}`);
  },
  submitOrder: handleSubmitOrder,
  modifyOrder: () => {
    throw new Error('Not implemented');
  },
  cancelOrder: handleCancelOrder,
});
