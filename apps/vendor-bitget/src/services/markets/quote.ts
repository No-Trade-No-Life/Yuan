import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { requestSQL, writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, groupBy, map, merge, mergeMap, repeat, retry, scan, shareReplay, Subject, tap } from 'rxjs';
import {
  IFundingTimeInfo,
  IFutureMarketTicker,
  getFutureMarketTickers,
  getNextFundingTime,
} from '../../api/public-api';
import { createCyclicTask } from './utils/cyclic-task';

const usdtFuturesTickers$ = defer(() => getFutureMarketTickers({ productType: 'USDT-FUTURES' })).pipe(
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const coinFuturesTickers$ = defer(() => getFutureMarketTickers({ productType: 'COIN-FUTURES' })).pipe(
  retry({ delay: 5000 }),
  repeat({ delay: 5000 }),
  shareReplay(1),
);

const mapTickerToQuote =
  (instType: string) =>
  (ticker: IFutureMarketTicker): Partial<IQuote> => ({
    datasource_id: 'BITGET',
    product_id: encodePath(instType, ticker.symbol),
    last_price: ticker.lastPr,
    ask_price: ticker.askPr,
    ask_volume: ticker.askSz,
    bid_price: ticker.bidPr,
    bid_volume: ticker.bidSz,
    interest_rate_long: `${-Number(ticker.fundingRate)}`,
    interest_rate_short: `${Number(ticker.fundingRate)}`,
    open_interest: ticker.holdingAmount,
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
    const res = await getNextFundingTime({
      symbol: instId,
      productType: instType,
    });

    if (res.msg !== 'success') {
      throw new Error(res.msg);
    }

    console.info(formatTime(Date.now()), 'FundingTime', product_id, res.data[0].nextFundingTime);

    const data: IFundingTimeInfo | undefined = res.data[0];
    if (!data) {
      return;
    }

    fundingTimeQuote$.next({
      datasource_id: 'BITGET',
      product_id,
      interest_rate_next_settled_at: formatTime(+data.nextFundingTime),
      interest_rate_prev_settled_at: formatTime(+data.nextFundingTime - +data.ratePeriod * 3600_000),
    });
  },
  dispose$: Terminal.fromNodeEnv().dispose$,
});
