import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { ICredential } from '../api/client';
import { listProducts } from '../public-data/product';
import { getCredentialId } from './accounts/profile';
import { getSpotAccountInfoSnapshot } from './accounts/spot';
import { getUnifiedAccountInfo } from './accounts/unified';
import { cancelOrder } from './orders/cancelOrder';
import { getOrdersByProductId, listSpotOrders, listUnifiedUmOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

provideExchangeServices<ICredential>(terminal, {
  name: 'BINANCE',
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
  getPositions: async function (credential: ICredential): Promise<IPosition[]> {
    const [uFuturePositions, spotPositions] = await Promise.all([
      getUnifiedAccountInfo(credential),
      getSpotAccountInfoSnapshot(credential),
    ]);
    return [...uFuturePositions, ...spotPositions];
  },
  getOrders: async function (credential: ICredential): Promise<IOrder[]> {
    const [umOrders, spotOrders] = await Promise.all([
      listUnifiedUmOrders(credential),
      listSpotOrders(credential),
    ]);
    return [...umOrders, ...spotOrders];
  },
  getPositionsByProductId: async function (
    credential: ICredential,
    product_id: string,
  ): Promise<IPosition[]> {
    const [_, instType] = decodePath(product_id); // BINANCE/USDT-FUTURE/ADAUSDT
    if (instType === 'SPOT') {
      const positions = await getSpotAccountInfoSnapshot(credential);
      return positions.filter((position) => position.product_id === product_id);
    }
    if (instType === 'USDT-FUTURE') {
      const positions = await getUnifiedAccountInfo(credential);
      return positions.filter((position) => position.product_id === product_id);
    }
    throw new Error(`Unsupported instType: ${instType}`);
  },
  getOrdersByProductId,
  submitOrder,
  modifyOrder,
  cancelOrder,
});
