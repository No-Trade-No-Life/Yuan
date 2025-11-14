import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath } from '@yuants/utils';
import { defer, filter, from, map, mergeMap, repeat, retry, shareReplay } from 'rxjs';
import { getFuturesTickers } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const futuresTickers$ = defer(() => getFuturesTickers('usdt')).pipe(
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quote$ = futuresTickers$.pipe(
  mergeMap((tickers) => from(Array.isArray(tickers) ? tickers : [])),
  map(
    (ticker): IQuote => ({
      datasource_id: 'GATE-FUTURE',
      product_id: ticker.contract,
      updated_at: new Date().toISOString(),
      last_price: `${ticker.last ?? '0'}`,
      ask_price: `${ticker.lowest_ask ?? '0'}`,
      ask_volume: `${ticker.lowest_size ?? '0'}`,
      bid_price: `${ticker.highest_bid ?? '0'}`,
      bid_volume: `${ticker.highest_size ?? '0'}`,
      open_interest: `${ticker.total_size ?? '0'}`,
      interest_rate_long: `${-(Number(ticker.funding_rate ?? 0))}`,
      interest_rate_short: `${Number(ticker.funding_rate ?? 0)}`,
      interest_rate_prev_settled_at: '',
      interest_rate_next_settled_at: '',
    }),
  ),
  shareReplay({ bufferSize: 1, refCount: true }),
);

terminal.channel.publishChannel('quote', { pattern: '^GATE-FUTURE/' }, (channel_id) => {
  const [, product_id] = decodePath(channel_id);
  if (!product_id) {
    throw new Error(`Invalid quote channel id: ${channel_id}`);
  }
  return quote$.pipe(filter((quote) => quote.product_id === product_id));
});

if (process.env.WRITE_QUOTE_TO_SQL === 'true' || process.env.WRITE_QUOTE_TO_SQL === '1') {
  quote$
    .pipe(
      writeToSQL({
        terminal,
        tableName: 'quote',
        conflictKeys: ['datasource_id', 'product_id'],
        writeInterval: 1000,
      }),
    )
    .subscribe();
}
