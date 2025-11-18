import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { cancelOrder } from './orders/cancelOrder';
import { submitOrder } from './orders/submitOrder';
import { listOrders } from './orders/listOrders';
import { ICredential } from '../api/private-api';

provideOrderActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'GATE',
  {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    submitOrder,
    cancelOrder,
    listOrders,
  },
);
