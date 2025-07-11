import { UUID } from '@yuants/utils';
import { Terminal } from '@yuants/protocol';

export const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `CCXT/${process.env.EXCHANGE_ID || 'default'}/${UUID()}`,
  name: `CCXT`,
});
