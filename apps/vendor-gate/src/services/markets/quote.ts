import { IQuote, setMetricsQuoteState } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath } from '@yuants/utils';
import {
  catchError,
  defer,
  EMPTY,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  repeat,
  retry,
  scan,
  share,
  shareReplay,
} from 'rxjs';
import { getFuturesContracts, getFuturesTickers, getSpotTickers } from '../../api/public-api';

const terminal = Terminal.fromNodeEnv();

// 获取所有USDT永续合约
const usdtFutureContracts$ = defer(() => getFuturesContracts('usdt', {})).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);

// 从tickers获取价格和交易量数据
const quoteFromTickers$ = defer(() => getFuturesTickers('usdt', {})).pipe(
  mergeMap((tickers) => tickers),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'GATE',
      product_id: encodePath('GATE', 'FUTURE', ticker.contract),
      last_price: ticker.last,
      ask_price: ticker.lowest_ask,
      bid_price: ticker.highest_bid,
      // GATE API doesn't provide bid/ask volumes in tickers endpoint
      // We'll need to use order book for that if required
      ask_volume: '0',
      bid_volume: '0',
      // total_size is the open interest
      open_interest: ticker.total_size,
      // funding_rate is the current funding rate
      interest_rate_long: ticker.funding_rate ? `${-parseFloat(ticker.funding_rate)}` : undefined,
      interest_rate_short: ticker.funding_rate,
    }),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 1000 }),
);

// 从现货tickers获取价格和交易量数据
const quoteFromSpotTickers$ = defer(() => getSpotTickers({})).pipe(
  mergeMap((tickers) => tickers),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'GATE',
      product_id: encodePath('GATE', 'SPOT', ticker.currency_pair),
      last_price: ticker.last,
      ask_price: ticker.lowest_ask,
      bid_price: ticker.highest_bid,
      ask_volume: ticker.lowest_size ?? '0',
      bid_volume: ticker.highest_size ?? '0',
      // 现货没有持仓量的概念，设置为0
      open_interest: '0',
    }),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 1000 }),
);

const quoteSources$ = [quoteFromTickers$, quoteFromSpotTickers$];

const quote$ = defer(() =>
  merge(
    ...quoteSources$.map((x$) =>
      defer(() => x$).pipe(
        // 防止单个流关闭导致整体关闭
        catchError(() => EMPTY),
      ),
    ),
  ),
).pipe(
  groupBy((x) => encodePath(x.datasource_id, x.product_id)),
  mergeMap((group$) => {
    return group$.pipe(
      //
      scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>),
    );
  }),
  share(),
);

// 写入数据库
if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  terminal.channel.publishChannel('quote', { pattern: `^GATE/` }, (channel_id) => {
    const [datasource_id, product_id] = decodePath(channel_id);
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    return quote$.pipe(filter((x) => x.product_id === product_id));
  });
  quote$
    .pipe(
      setMetricsQuoteState(terminal.terminal_id),
      writeToSQL({
        terminal,
        writeInterval: 1000,
        tableName: 'quote',
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}
