import { UUID } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { ProApiV2Client } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `Solscan/${UUID()}`,
  name: 'Solscan API',
});

const client = new ProApiV2Client(process.env.SOLSCAN_API_TOKEN!);

terminal.provideService(
  'solscan/account/detail',
  {
    type: 'object',
    required: ['address'],
    properties: { address: { type: 'string' } },
  },
  async (msg) => {
    const { address } = msg.req as { address: string };
    const data = await client.getAccountDetail({ address });
    return { res: { code: 0, message: 'OK', data } };
  },
);

terminal.provideService(
  'solscan/account/transactions',
  {
    type: 'object',
    required: ['address'],
    properties: { address: { type: 'string' }, before: { type: 'string' }, limit: { type: 'number' } },
  },
  async (msg) => {
    const { address, before, limit } = msg.req as { address: string; before?: string; limit?: number };
    const data = await client.getAccountTransactions({ address, before, limit });
    return { res: { code: 0, message: 'OK', data } };
  },
);

terminal.provideService(
  'solscan/account/token-accounts',
  {
    type: 'object',
    required: ['address', 'type'],
    properties: {
      address: { type: 'string' },
      type: { type: 'string', enum: ['token', 'nft'] },
      page: { type: 'number' },
      page_size: { type: 'number' },
      hide_zero: { type: 'boolean' },
    },
  },
  async (msg) => {
    const { address, type, page, page_size, hide_zero } = msg.req as {
      address: string;
      type: 'token' | 'nft';
      page?: number;
      page_size?: number;
      hide_zero?: boolean;
    };
    const data = await client.getAccountTokenAccounts({ address, type, page, page_size, hide_zero });
    return { res: { code: 0, message: 'OK', data } };
  },
);

terminal.provideService(
  'solscan/token/meta',
  {
    type: 'object',
    required: ['address'],
    properties: { address: { type: 'string' } },
  },
  async (msg) => {
    const { address } = msg.req as { address: string };
    const data = await client.getTokenMeta({ address });
    return { res: { code: 0, message: 'OK', data } };
  },
);
