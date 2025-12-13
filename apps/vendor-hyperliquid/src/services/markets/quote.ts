import { IQuote, setMetricsQuoteState } from '@yuants/data-quote';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import { defer, filter, map, mergeMap, repeat, retry, shareReplay, withLatestFrom } from 'rxjs';
import { getAllMids, getMetaAndAssetCtxs } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();
const ASSET_CTX_REFRESH_INTERVAL = Number(process.env.ASSET_CTX_REFRESH_INTERVAL ?? 5_000);

type HyperliquidAssetContext = Awaited<ReturnType<typeof getMetaAndAssetCtxs>>[1][number];

const assetCtxMap$ = defer(() => getMetaAndAssetCtxs()).pipe(
  map(([meta, assetCtxs]) => {
    const entries = meta?.universe?.map<[string, HyperliquidAssetContext | undefined]>((asset, index) => [
      asset.name,
      assetCtxs?.[index],
    ]);
    return new Map(entries?.filter(([, ctx]) => !!ctx) ?? []);
  }),
  repeat({ delay: ASSET_CTX_REFRESH_INTERVAL }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const quote$ = defer(() => getAllMids()).pipe(
  map((mids) => Object.entries(mids ?? {})),
  mergeMap((entries) => entries),
  withLatestFrom(assetCtxMap$),
  map(([entry, assetCtxMap]): Partial<IQuote> => {
    const [coin, price] = entry;
    const ctx = assetCtxMap.get(coin);
    return {
      datasource_id: 'HYPERLIQUID',
      product_id: encodePath('HYPERLIQUID', 'PERPETUAL', `${coin}-USD`),
      last_price: `${price}`,
      bid_price: `${price}`,
      ask_price: `${price}`,
      open_interest: `${ctx?.openInterest ?? 0}`,
      interest_rate_long: ctx?.funding ? `${-+ctx.funding}` : undefined,
      interest_rate_short: ctx?.funding,
      updated_at: new Date().toISOString(),
    };
  }),
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay({ bufferSize: 1, refCount: true }),
);

const shouldWriteQuoteToSQL = /^(1|true)$/i.test(process.env.WRITE_QUOTE_TO_SQL ?? '');

const MetricsQuoteState = GlobalPrometheusRegistry.gauge(
  'quote_state',
  'The latest quote state from public data',
);

if (shouldWriteQuoteToSQL) {
  quote$
    .pipe(
      setMetricsQuoteState(terminal.terminal_id),
      writeToSQL({
        terminal,
        tableName: 'quote',
        writeInterval: 1000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

terminal.channel.publishChannel('quote', { pattern: '^HYPERLIQUID/' }, (channel_id) => {
  const [datasourceId] = decodePath(channel_id);
  if (datasourceId !== 'HYPERLIQUID') {
    throw new Error(`Invalid channel_id: ${channel_id}`);
  }
  return quote$.pipe(filter((quote) => quote.product_id === channel_id));
});
