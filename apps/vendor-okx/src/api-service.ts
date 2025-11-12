import { Terminal } from '@yuants/protocol';
import { getPositionTiers } from './public-api';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<
  {
    instType: string;
    tdMode: string;
    instFamily?: string;
    instId?: string;
    uly?: string;
    ccy?: string;
    tier?: string;
  },
  Awaited<ReturnType<typeof getPositionTiers>>
>(
  'OKX/PositionTiers',
  {
    required: ['instType', 'tdMode'],
    properties: {
      instType: { type: 'string' },
      tdMode: { type: 'string' },
      instFamily: { type: 'string' },
      instId: { type: 'string' },
      uly: { type: 'string' },
      ccy: { type: 'string' },
      tier: { type: 'string' },
    },
  },
  async (msg) => {
    const data = await getPositionTiers(msg.req);
    return {
      res: {
        code: 0,
        message: 'OK',
        data,
      },
    };
  },
  {
    concurrent: 1,
    egress_token_capacity: 10,
    egress_token_refill_interval: 2100,
  },
);
