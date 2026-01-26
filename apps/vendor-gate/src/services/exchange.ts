import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { getEarningAccountInfo } from './accounts/earning';
import { getCredentialId } from './accounts/profile';
import { getUnifiedAccountInfo } from './accounts/unified';
import { listProducts } from './markets/product';
import { cancelOrder } from './orders/cancelOrder';
import { getOrdersByProductId, listOrders } from './orders/listOrders';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

const getAllPositions = async (credential: ICredential): Promise<IPosition[]> => {
  const credentialId = await getCredentialId(credential);
  const [unifiedPositions, earningPositions] = await Promise.all([
    getUnifiedAccountInfo(credential),
    getEarningAccountInfo(credential),
  ]);
  return [...unifiedPositions, ...earningPositions];
};

provideExchangeServices<ICredential>(terminal, {
  name: 'GATE',
  credentialSchema: {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  getCredentialId,
  listProducts,
  getPositions: getAllPositions,
  getOrders: async function (credential: ICredential): Promise<IOrder[]> {
    const [umOrders] = await Promise.all([
      listOrders(credential),
      //   listSpotOrders(credential),
    ]);
    return [...umOrders];
  },
  getPositionsByProductId: async function (
    credential: ICredential,
    product_id: string,
  ): Promise<IPosition[]> {
    const positions = await getAllPositions(credential);
    return positions.filter((position) => position.product_id === product_id);
  },
  getOrdersByProductId,
  submitOrder,
  modifyOrder: () => {
    throw new Error('Not implemented');
  },
  cancelOrder,
});
