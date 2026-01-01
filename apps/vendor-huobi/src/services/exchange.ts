import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, encodePath, newError } from '@yuants/utils';
import { ICredential, getAccountAssetsMode, getUid } from '../api/private-api';
import { getSpotAccountInfo } from './accounts/spot';
import { getSuperMarginAccountInfo } from './accounts/super-margin';
import { getSwapAccountInfo, getUnionAccountInfo } from './accounts/swap';
import { listSwapOrders } from './orders/listOrders';
import { submitOrder } from './orders/submitOrder';
import { listProducts } from './product';
import { createCache } from '@yuants/cache';

const terminal = Terminal.fromNodeEnv();

export const accountModeCache = createCache(
  async (credentialKey: string) => {
    const [access_key, secret_key] = decodePath(credentialKey);
    const credential = { access_key, secret_key };
    const res = await getAccountAssetsMode(credential);
    return res.data.asset_mode;
  },
  {
    expire: 600_000, // 10 minutes
    swrAfter: 60_000, // 1 minute
  },
);

provideExchangeServices<ICredential>(terminal, {
  name: 'HTX',
  credentialSchema: {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  getCredentialId: async (credential) => {
    const res = await getUid(credential);
    return encodePath('HTX', res.data);
  },
  listProducts,
  getPositions: async (credential) => {
    const accountMode = await accountModeCache.query(
      encodePath(credential.access_key, credential.secret_key),
    );
    if (accountMode === 1) {
      const [swap, spot, superMargin] = await Promise.all([
        getUnionAccountInfo(credential),
        getSpotAccountInfo(credential, 'spot'),
        getSuperMarginAccountInfo(credential, 'super-margin'),
      ]);
      return [...swap, ...spot, ...superMargin];
    } else {
      const [swap, spot, superMargin] = await Promise.all([
        getSwapAccountInfo(credential),
        getSpotAccountInfo(credential, 'spot'),
        getSuperMarginAccountInfo(credential, 'super-margin'),
      ]);
      return [...swap, ...spot, ...superMargin];
    }
  },
  getOrders: async (credential) => {
    const swapOrders = await listSwapOrders(credential);
    return swapOrders;
  },
  submitOrder,
  cancelOrder: async (credential, order) => {
    throw new Error('Not Implemented');
  },
  modifyOrder: async (credential, order) => {
    throw new Error('Not Implemented');
  },
  getPositionsByProductId: async (credential, product_id) => {
    const [, instType] = decodePath(product_id);
    if (instType === 'SPOT') {
      const positions = await getSpotAccountInfo(credential, product_id);
      return positions.filter((pos) => pos.product_id === product_id);
    }
    if (instType === 'SWAP') {
      const positions = await getSwapAccountInfo(credential);
      return positions.filter((pos) => pos.product_id === product_id);
    }
    if (instType === 'SUPER-MARGIN') {
      const positions = await getSuperMarginAccountInfo(credential, product_id);
      return positions.filter((pos) => pos.product_id === product_id);
    }
    throw newError('UnsupportedProductId', { product_id });
  },
  getOrdersByProductId: async (credential: ICredential, product_id: string): Promise<IOrder[]> => {
    const [, instType] = decodePath(product_id);
    // if (instType === 'SPOT') {
    //   const orders = await listSpotOrders(credential, product_id);
    //   return orders.filter((order) => order.product_id === product_id);
    // }
    if (instType === 'SWAP') {
      const orders = await listSwapOrders(credential);
      return orders.filter((order) => order.product_id === product_id);
    }
    throw newError('UnsupportedProductId', { product_id });
  },
});
