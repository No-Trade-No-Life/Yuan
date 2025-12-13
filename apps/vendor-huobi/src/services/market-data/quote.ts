import { createCache } from '@yuants/cache';
import { IQuote } from '@yuants/data-quote';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL, writeToSQL } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import {
  defer,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  repeat,
  retry,
  scan,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import {
  getSpotMarketTickers,
  getSwapBatchFundingRate,
  getSwapMarketBbo,
  getSwapMarketTrade,
  getSwapOpenInterest,
} from '../../api/public-api';

const swapBboTick$ = defer(() => getSwapMarketBbo({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const quote1$ = swapBboTick$.pipe(
  mergeMap((res) => res.ticks || []),
  map((tick): Partial<IQuote> => {
    const [ask_price = '', ask_volume = ''] = tick.ask || [];
    const [bid_price = '', bid_volume = ''] = tick.bid || [];
    return {
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      ask_price: `${ask_price}`,
      bid_price: `${bid_price}`,
      ask_volume: `${ask_volume}`,
      bid_volume: `${bid_volume}`,
    };
  }),
);

const mapSwapContractCodeToBboTick$ = defer(() => swapBboTick$).pipe(
  mergeMap((res) =>
    from(res.ticks).pipe(
      map((tick) => [tick.contract_code, tick] as const),
      toArray(),
      map((ticks) => Object.fromEntries(ticks)),
    ),
  ),

  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const swapTradeTick$ = defer(() => getSwapMarketTrade({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const quote2$ = swapTradeTick$.pipe(
  mergeMap((res) => res.tick?.data || []),
  map(
    (tick): Partial<IQuote> => ({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      last_price: `${tick.price}`,
    }),
  ),
);

const quote5$ = defer(() => getSpotMarketTickers()).pipe(
  mergeMap((res) => res.data || []),
  map(
    (tick): Partial<IQuote> => ({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SPOT', tick.symbol),
      ask_price: `${tick.ask}`,
      bid_price: `${tick.bid}`,
      ask_volume: `${tick.askSize}`,
      bid_volume: `${tick.bidSize}`,
      last_price: `${tick.close}`,
    }),
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const mapSwapContractCodeToTradeTick$ = defer(() => swapTradeTick$).pipe(
  mergeMap((res) =>
    from(res.tick.data).pipe(
      map((tick) => [tick.contract_code, tick] as const),
      toArray(),
      map((ticks) => Object.fromEntries(ticks)),
    ),
  ),

  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);
const swapFundingRateTick$ = defer(() => getSwapBatchFundingRate({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const quote3$ = swapFundingRateTick$.pipe(
  mergeMap((res) => res.data || []),
  map(
    (tick): Partial<IQuote> => ({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      interest_rate_long: `${-tick.funding_rate}`,
      interest_rate_short: `${tick.funding_rate}`,
      interest_rate_next_settled_at: formatTime(+tick.funding_time),
    }),
  ),
);

const mapSwapContractCodeToFundingRateTick$ = defer(() => swapFundingRateTick$).pipe(
  mergeMap((res) =>
    from(res.data).pipe(
      map((tick) => [tick.contract_code, tick] as const),
      toArray(),
      map((ticks) => Object.fromEntries(ticks)),
    ),
  ),

  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const swapOpenInterest$ = defer(() => getSwapOpenInterest({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const quote4$ = swapOpenInterest$.pipe(
  mergeMap((res) => res.data || []),
  map(
    (tick): Partial<IQuote> => ({
      datasource_id: 'HTX',
      product_id: encodePath('HTX', 'SWAP', tick.contract_code),
      open_interest: `${tick.volume}`,
    }),
  ),
);

const MetricsQuoteState = GlobalPrometheusRegistry.gauge(
  'quote_state',
  'The latest quote state from public data',
);

if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  // 合并不同来源的数据并进行合并，避免死锁
  merge(quote1$, quote2$, quote3$, quote4$, quote5$)
    .pipe(
      groupBy((x) => encodePath(x.datasource_id, x.product_id)),
      mergeMap((group$) => {
        return group$.pipe(scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>));
      }),
    )
    .pipe(
      tap((x) => {
        const fields = Object.keys(x).filter(
          (key) => !['datasource_id', 'product_id', 'updated_at'].includes(key),
        );
        for (const field of fields) {
          const value = (x as any)[field];
          if (typeof value === 'number') {
            MetricsQuoteState.labels({
              terminal_id: terminal.terminal_id,
              product_id: x.product_id!,
              field,
            }).set(value);
          }
        }
      }),
      writeToSQL({
        terminal: Terminal.fromNodeEnv(),
        tableName: 'quote',
        writeInterval: 1000,
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

const mapSwapContractCodeToOpenInterest$ = defer(() => swapOpenInterest$).pipe(
  mergeMap((res) =>
    from(res.data).pipe(
      map((tick) => [tick.contract_code, tick] as const),
      toArray(),
      map((ticks) => Object.fromEntries(ticks)),
    ),
  ),

  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
  shareReplay(1),
);

const terminal = Terminal.fromNodeEnv();

export const quoteCache = createCache<IQuote>(
  async (product_id) => {
    const sql = `select * from quote where product_id = ${escapeSQL(product_id)}`;
    console.info('QuoteSQL', sql);
    const [quote] = await requestSQL<IQuote[]>(terminal, sql);
    console.info('QuoteFetched', product_id, JSON.stringify(quote));
    return quote;
  },
  { expire: 10_000 },
);

// provideTicks(Terminal.fromNodeEnv(), 'HUOBI-SWAP', (product_id) => {
//   return defer(async () => {
//     const products = await firstValueFrom(perpetualContractProducts$);
//     const theProduct = products.find((x) => x.product_id === product_id);
//     if (!theProduct) throw `No Found ProductID ${product_id}`;

//     return [
//       of(theProduct),
//       mapSwapContractCodeToBboTick$,
//       mapSwapContractCodeToTradeTick$,
//       mapSwapContractCodeToFundingRateTick$,
//       mapSwapContractCodeToOpenInterest$,
//     ] as const;
//   }).pipe(
//     catchError(() => EMPTY),
//     mergeMap((x) =>
//       combineLatest(x).pipe(
//         map(([theProduct, bboTick, tradeTick, fundingRateTick, openInterest]): ITick => {
//           return {
//             datasource_id: 'HUOBI-SWAP',
//             product_id,
//             updated_at: Date.now(),
//             settlement_scheduled_at: +fundingRateTick[product_id].funding_time,
//             price: +tradeTick[product_id].price,
//             ask: bboTick[product_id].ask?.[0] ?? undefined,
//             bid: bboTick[product_id].bid?.[0] ?? undefined,
//             volume: +tradeTick[product_id].amount,
//             interest_rate_for_long: -+fundingRateTick[product_id].funding_rate,
//             interest_rate_for_short: +fundingRateTick[product_id].funding_rate,
//             open_interest: +openInterest[product_id]?.volume,
//           };
//         }),
//       ),
//     ),
//   );
// });
