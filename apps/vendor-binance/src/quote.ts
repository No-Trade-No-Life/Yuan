import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import { combineLatest, defer, filter, from, map, mergeMap, repeat, retry, shareReplay, toArray } from 'rxjs';
import { client } from './api';

const terminal = Terminal.fromNodeEnv();

const mapSymbolToFuturePremiumIndex$ = defer(() => client.getFuturePremiumIndex({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.symbol, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const mapSymbolToFutureBookTicker$ = defer(() => client.getFutureBookTicker({})).pipe(
  repeat({ delay: 1_000 }),
  retry({ delay: 30_000 }),
  mergeMap((x) =>
    from(x).pipe(
      map((v) => [v.symbol, v] as const),
      toArray(),
      map((v) => new Map(v)),
    ),
  ),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quote$ = combineLatest([mapSymbolToFuturePremiumIndex$, mapSymbolToFutureBookTicker$]).pipe(
  mergeMap(([premiumIndexMap, bookTickerMap]) =>
    from(
      [...bookTickerMap.entries()].map(([symbol, ticker]) => ({
        symbol,
        ticker,
        premium: premiumIndexMap.get(symbol),
      })),
    ),
  ),
  map(({ symbol, ticker, premium }): Partial<IQuote> => {
    const updatedAt = new Date(ticker?.time ?? premium?.time ?? Date.now()).toISOString();
    return {
      datasource_id: 'BINANCE',
      product_id: encodePath('usdt-future', symbol),
      last_price: premium?.markPrice ?? ticker.bidPrice ?? ticker.askPrice,
      bid_price: ticker.bidPrice,
      ask_price: ticker.askPrice,
      updated_at: updatedAt,
    };
  }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  quote$
    .pipe(
      writeToSQL({
        terminal,
        tableName: 'quote',
        writeInterval: 1_000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();

  terminal.channel.publishChannel('quote', { pattern: '^BINANCE/' }, (channel_id) => {
    const [datasourceId, productId] = decodePath(channel_id);
    if (!datasourceId || !productId) {
      throw new Error(`Invalid channel_id: ${channel_id}`);
    }
    return quote$.pipe(filter((quote) => quote.product_id === productId));
  });
}
