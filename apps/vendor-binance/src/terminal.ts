import { Terminal } from '@yuants/protocol';
import { UUID } from '@yuants/utils';

export const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `binance/${UUID()}`,
  name: '@yuants/vendor-binance',
});
