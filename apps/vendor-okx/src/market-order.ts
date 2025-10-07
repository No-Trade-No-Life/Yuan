import { Terminal } from '@yuants/protocol';
import { client } from './api';
import { decodePath, formatTime } from '@yuants/utils';
import { useMarketBooks } from './ws';
import { map } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService(
  'QueryMarketBooks',
  {
    required: ['product_id', 'datasource_id'],
    properties: {
      product_id: { type: 'string' },
      datasource_id: { type: 'string', const: 'OKX' },
    },
  },
  async (msg) => {
    const { sz = '1', product_id } = msg.req as { sz?: string; product_id: string };
    const [, instId] = decodePath(product_id);
    const result = await client.getMarketBooks({
      sz,
      instId,
    });
    if (result.code === '0') {
      return { res: { code: 0, message: 'OK', data: result.data } };
    }
    return { res: { code: 500, message: 'Server Error' } };
  },
);

terminal.channel.publishChannel('MarketBooks', { pattern: `^OKX/` }, (id) => {
  const [datasource_id, product_id] = decodePath(id);
  const [, instId] = decodePath(product_id);
  console.info(formatTime(Date.now()), `SubscribeMarketBooks`, id);

  return useMarketBooks('books', instId).pipe(
    map((data) => {
      return data[0];
    }),
  );
});
