import { UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';

export const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `okx/${UUID()}`,
  name: 'OKX',
});
