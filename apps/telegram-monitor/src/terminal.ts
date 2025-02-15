import { Terminal } from '@yuants/protocol';

export const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: `telegram`,
  name: 'Telegram',
});
