import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { type ICredential } from '../api/private-api';
import { cancelOrder } from './orders/cancelOrder';
import { listOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

provideOrderActionsWithCredential<ICredential>(
  terminal,
  'BITGET',
  {
    type: 'object',
    required: ['access_key', 'secret_key', 'passphrase'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
      passphrase: { type: 'string' },
    },
  },
  {
    submitOrder,
    cancelOrder,
    modifyOrder,
    listOrders,
  },
);
