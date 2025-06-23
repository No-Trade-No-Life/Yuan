import { Terminal } from '@yuants/protocol';

export const terminal = new Terminal(process.env.HV_URL!, {
  terminal_id: process.env.TERMINAL_ID || `TradeCopier`,
  name: 'Trade Copier',
});
