import { provideExchangeServices } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath, newError } from '@yuants/utils';
import { getAccountConfig, ICredential } from '../api/private-api';
import { cancelOrder } from '../orders/cancelOrder';
import { modifyOrder } from '../orders/modifyOrder';
import { submitOrder } from '../orders/submitOrder';
import { getOrders } from './getOrders';
import { getPositions } from './getPositions';
import { listProducts } from './product';

const terminal = Terminal.fromNodeEnv();

provideExchangeServices<ICredential>(terminal, {
  name: 'OKX',
  credentialSchema: {
    type: 'object',
    required: ['access_key', 'secret_key', 'passphrase'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
      passphrase: { type: 'string' },
    },
  },
  getCredentialId: async function (credential: ICredential): Promise<string> {
    const res = await getAccountConfig(credential);
    const uid = res.data?.[0]?.uid;
    if (!uid) throw newError('OKX_CREDENTIAL_INVALID', { res });
    return encodePath('OKX', uid);
  },
  listProducts: listProducts,
  getPositions: getPositions,
  getOrders,
  getPositionsByProductId: async (credential, product_id) => {
    const positions = await getPositions(credential);
    return positions.filter((x) => x.product_id === product_id);
  },
  getOrdersByProductId: async (credential, product_id) => {
    const orders = await getOrders(credential);
    return orders.filter((x) => x.product_id === product_id);
  },
  submitOrder: submitOrder,
  modifyOrder: modifyOrder,
  cancelOrder: cancelOrder,
});
