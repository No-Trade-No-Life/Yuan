import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/client';
import { listProducts } from '../public-data/product';
import { getCredentialId } from './accounts/profile';
import { getPositions } from './accounts/unified';
import { cancelOrder } from './orders/cancelOrder';
import { getOrdersByProductId, listSpotOrders, listUnifiedUmOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';
import { newError } from '@yuants/utils/lib/error';
import { getTradeOrderDetail } from './orders/getOrderDetail';
import { decodePath } from '@yuants/utils/lib/path';

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
  getPositions: getPositions,
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
    const positions = await getPositions(credential);
    return positions.filter((position) => position.product_id === product_id);
  },
  getOrdersByProductId,
  submitOrder,
  modifyOrder,
  cancelOrder,
  getOrderByOrderId: async (credential, params) => {
    const { product_id, order_id } = params as { product_id: string; order_id: number };
    if (!product_id || !order_id) {
      throw newError('BINANCE_GET_ORDER_BY_ID_MISSING_PARAMS', { params });
    }
    const [_, __, symbol] = decodePath(product_id); // BINANCE/USDT-FUTURES/BTCUSDT
    const order = await getTradeOrderDetail(credential, symbol, order_id);
    return order;
  },
});
