import { provideOrderActionsWithCredential } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();

provideOrderActionsWithCredential(
  terminal,
  'HTX',
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
  },
);
