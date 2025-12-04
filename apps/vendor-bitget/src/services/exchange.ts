import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { ICredential } from '../api/types';
import { resolveAccountProfile } from './accounts/profile';
import { getAccountInfo } from './accounts/account';
import { listProducts } from './markets/product';
import { cancelOrder } from './orders/cancelOrder';
import { listFuturesOrders, listSpotOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

const getCredentialId = async (credential: ICredential) => {
  const profile = await resolveAccountProfile(credential);
  return `BITGET/${profile.uid}`;
};

provideExchangeServices<ICredential>(terminal, {
  name: 'BITGET',
  credentialSchema: {
    type: 'object',
    required: ['access_key', 'secret_key', 'passphrase'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
      passphrase: { type: 'string' },
    },
  },
  getCredentialId,
  listProducts,
  getPositions: async function (credential: ICredential): Promise<IPosition[]> {
    return getAccountInfo(credential);
  },
  getOrders: async function (credential: ICredential): Promise<IOrder[]> {
    const [futuresOrders, spotOrders] = await Promise.all([
      listFuturesOrders(credential),
      listSpotOrders(credential),
    ]);
    return [...futuresOrders, ...spotOrders];
  },
  getPositionsByProductId: async function (
    credential: ICredential,
    product_id: string,
  ): Promise<IPosition[]> {
    const [_, instType] = decodePath(product_id); // BITGET/USDT-FUTURES/BTCUSDT
    const positions = await getAccountInfo(credential);
    return positions.filter((position) => position.product_id === product_id);
  },
  getOrdersByProductId: async function (credential: ICredential, product_id: string): Promise<IOrder[]> {
    const [_, instType] = decodePath(product_id); // BITGET/USDT-FUTURES/BTCUSDT
    if (instType === 'SPOT') {
      const orders = await listSpotOrders(credential);
      return orders.filter((order) => order.product_id === product_id);
    }
    if (instType === 'USDT-FUTURES') {
      const orders = await listFuturesOrders(credential);
      return orders.filter((order) => order.product_id === product_id);
    }
    throw new Error(`Unsupported instType: ${instType}`);
  },
  submitOrder,
  modifyOrder,
  cancelOrder,
});
