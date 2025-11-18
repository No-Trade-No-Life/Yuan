import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { handleCancelOrder } from './orders/cancelOrder';
import { handleSubmitOrder } from './orders/submitOrder';
import { listOrders } from './orders/listOrders';

provideOrderActionsWithCredential(
  Terminal.fromNodeEnv(),
  'ASTER',
  {
    type: 'object',
    required: ['address', 'api_key', 'secret_key'],
    properties: {
      address: { type: 'string' },
      api_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    submitOrder: handleSubmitOrder,
    cancelOrder: handleCancelOrder,
    listOrders,
  },
);
