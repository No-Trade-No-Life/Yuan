import { IQuote, setMetricsQuoteState } from '@yuants/data-quote';
import { GlobalPrometheusRegistry, Terminal } from '@yuants/protocol';
import { requestSQL, writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, groupBy, map, merge, mergeMap, repeat, retry, scan, shareReplay, Subject, tap } from 'rxjs';
import { getCurrentFundingRate, getTickers, IUtaCurrentFundingRate, IUtaTicker } from '../../api/public-api';
import { createCyclicTask } from './utils/cyclic-task';

const terminal = Terminal.fromNodeEnv();

const usdtFuturesTickers$ = defer(() => getTickers({ category: 'USDT-FUTURES' })).pipe(
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const coinFuturesTickers$ = defer(() => getTickers({ category: 'COIN-FUTURES' })).pipe(
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const mapTickerToQuote =
  (instType: string) =>
  (ticker: IUtaTicker): Partial<IQuote> => ({
    datasource_id: 'BITGET',
    product_id: encodePath('BITGET', instType, ticker.symbol),
    last_price: ticker.lastPrice,
    ask_price: ticker.ask1Price,
    ask_volume: ticker.ask1Size,
    bid_price: ticker.bid1Price,
    bid_volume: ticker.bid1Size,
    interest_rate_long: ticker.fundingRate ? `${-Number(ticker.fundingRate)}` : undefined,
    interest_rate_short: ticker.fundingRate ? `${Number(ticker.fundingRate)}` : undefined,
    open_interest: ticker.openInterest,
  });

const usdtFuturesQuote$ = usdtFuturesTickers$.pipe(
  mergeMap((res) => res.data || []),
  map(mapTickerToQuote('USDT-FUTURES')),
);

const coinFuturesQuote$ = coinFuturesTickers$.pipe(
  mergeMap((res) => res.data || []),
  map(mapTickerToQuote('COIN-FUTURES')),
);

const fundingTimeQuote$ = new Subject<Partial<IQuote>>();

const MetricsQuoteState = GlobalPrometheusRegistry.gauge(
  'quote_state',
  'The latest quote state from public data',
);

// 合并不同来源的数据并进行合并，避免死锁
merge(fundingTimeQuote$, usdtFuturesQuote$, coinFuturesQuote$)
  .pipe(
    groupBy((x) => encodePath(x.datasource_id, x.product_id)),
    mergeMap((group$) => {
      return group$.pipe(scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>));
    }),
  )
  .pipe(
    tap((x) =>
      console.info(formatTime(Date.now()), 'Quote', x.datasource_id, x.product_id, JSON.stringify(x)),
    ),
    setMetricsQuoteState(terminal.terminal_id),
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      tableName: 'quote',
      writeInterval: 1000,
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();

const swapProductIds: string[] = [];

defer(() =>
  requestSQL<{ product_id: string }[]>(
    Terminal.fromNodeEnv(),
    "SELECT product_id FROM product WHERE datasource_id = 'BITGET'",
  ),
)
  .pipe(
    //
    repeat({ delay: 3600_000 }),
    retry({ delay: 10_000 }),
  )
  .subscribe((x) => {
    swapProductIds.length = 0; // clear previous ids
    swapProductIds.push(...x.map((v) => v.product_id));
  });

createCyclicTask({
  data: swapProductIds,
  interval: 1000,
  task: async (product_id) => {
    const [instType, instId] = decodePath(product_id);
    const res = await getCurrentFundingRate({
      symbol: instId,
    });

    if (res.msg !== 'success') {
      throw new Error(res.msg);
    }

    const data: IUtaCurrentFundingRate | undefined = res.data?.[0];
    if (!data) {
      return;
    }

    console.info(formatTime(Date.now()), 'FundingTime', product_id, data.nextUpdate);

    const nextUpdateTs = +data.nextUpdate;

    fundingTimeQuote$.next({
      datasource_id: 'BITGET',
      product_id,
      interest_rate_next_settled_at: formatTime(nextUpdateTs),
      interest_rate_prev_settled_at: formatTime(nextUpdateTs - +data.fundingRateInterval * 3600_000),
    });
  },
  dispose$: Terminal.fromNodeEnv().dispose$,
});
