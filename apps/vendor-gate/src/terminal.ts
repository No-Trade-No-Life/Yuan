import { Terminal } from '@yuants/protocol';
import { UUID } from '@yuants/utils';

export const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `@yuants/vendor-gate/${UUID()}`,
  name: '@yuants/vendor-gate',
});
