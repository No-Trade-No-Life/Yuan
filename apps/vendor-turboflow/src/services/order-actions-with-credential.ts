import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { cancelOrderAction } from './orders/cancelOrder';
import { listOrders } from './orders/listOrders';
import { modifyOrder } from './orders/modifyOrder';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

provideOrderActionsWithCredential<ICredential>(
  terminal,
  'TURBOFLOW',
  {
    type: 'object',
    required: ['private_key'],
    properties: {
      private_key: {
        type: 'string',
        description: 'ED25519 Private Key (base58 encoded)',
      },
    },
  },
  {
    submitOrder: submitOrder,
    cancelOrder: cancelOrderAction,
    modifyOrder: modifyOrder,
    listOrders: listOrders,
  },
);
