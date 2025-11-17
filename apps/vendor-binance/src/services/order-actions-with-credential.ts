import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { submitOrder } from './orders/submitOrder';
import { cancelOrder } from './orders/cancelOrder';
import { listOrders } from './orders/listOrders';

const terminal = Terminal.fromNodeEnv();

provideOrderActionsWithCredential<ICredential>(
  terminal,
  'BINANCE',
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
