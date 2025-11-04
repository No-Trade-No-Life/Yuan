import type { IQuote } from '../../../libraries/data-quote/lib';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay } from 'rxjs';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

const quote$ = defer(() => client.getAllMids()).pipe(
  map((mids) => Object.entries(mids ?? {})),
  mergeMap((entries) => entries),
  map(
    ([coin, price]): Partial<IQuote> => ({
      datasource_id: 'HYPERLIQUID',
      product_id: encodePath('PERPETUAL', `${coin}-USD`),
      last_price: `${price}`,
      bid_price: `${price}`,
      ask_price: `${price}`,
      updated_at: new Date().toISOString(),
    }),
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  quote$
    .pipe(
      writeToSQL({
        terminal,
        tableName: 'quote',
        writeInterval: 1000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();

  terminal.channel.publishChannel('quote', { pattern: '^HYPERLIQUID/' }, (channel_id) => {
    const [datasourceId, productId] = decodePath(channel_id);
    if (!datasourceId || !productId) {
      throw new Error(`Invalid channel_id: ${channel_id}`);
    }
    return quote$.pipe(filter((quote) => quote.product_id === productId));
  });
}
