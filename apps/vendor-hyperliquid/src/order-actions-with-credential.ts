import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from './api/types';
import { cancelOrderAction } from './order-actions/cancelOrder';
import { submitOrder } from './order-actions/submitOrder';

const terminal = Terminal.fromNodeEnv();

provideOrderActionsWithCredential<ICredential>(
  terminal,
  'HYPERLIQUID',
  {
    type: 'object',
    required: ['private_key', 'address'],
    properties: {
      private_key: { type: 'string' },
      address: { type: 'string' },
    },
  },
  {
    submitOrder: submitOrder,
    cancelOrder: cancelOrderAction,
  },
);
