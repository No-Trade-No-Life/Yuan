import type { IQuote } from '../../../libraries/data-quote/lib';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay } from 'rxjs';
import { getFApiV1TickerPrice } from './api';

const terminal = Terminal.fromNodeEnv();

const quote$ = defer(() => getFApiV1TickerPrice({})).pipe(
  mergeMap((tickers) => tickers || []),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'ASTER',
      product_id: encodePath('PERPETUAL', ticker.symbol),
      last_price: `${ticker.price}`,
      bid_price: `${ticker.price}`,
      ask_price: `${ticker.price}`,
      updated_at: new Date(ticker.time ?? Date.now()).toISOString(),
    }),
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

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

terminal.channel.publishChannel('quote', { pattern: '^ASTER/' }, (channel_id) => {
  const [datasourceId, productId] = decodePath(channel_id);
  if (!datasourceId || !productId) {
    throw new Error(`Invalid channel_id: ${channel_id}`);
  }
  return quote$.pipe(filter((quote) => quote.product_id === productId));
});
