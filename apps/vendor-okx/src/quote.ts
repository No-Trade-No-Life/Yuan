import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime, listWatch } from '@yuants/utils';
import {
  catchError,
  defer,
  EMPTY,
  filter,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  Observable,
  repeat,
  retry,
  scan,
  share,
  shareReplay,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { client } from './api';
import { OKXWsClient } from './websocket';

const wsPool: {
  client: OKXWsClient;
  requests: number;
  isFull: boolean;
}[] = [];

// ISSUE: 连接限制：3 次/秒 (基于IP)
//
// https://www.okx.com/docs-v5/zh/#overview-websocket-connect
//
// 当订阅公有频道时，使用公有服务的地址；当订阅私有频道时，使用私有服务的地址
//
// 请求限制：
//
// 每个连接 对于 订阅/取消订阅/登录 请求的总次数限制为 480 次/小时
const getWsClient = () => {
  const existing = wsPool.find((item) => !item.isFull);
  if (existing) {
    existing.requests++;
    if (existing.requests >= 480) {
      existing.isFull = true;
    }
    return existing.client;
  }
  const newClient = new OKXWsClient('ws/v5/public');
  wsPool.push({ client: newClient, requests: 1, isFull: false });
  return newClient;
};

const fromWsChannelAndInstId = (channel: string, instId: string) =>
  defer(
    () =>
      new Observable<any>((subscriber) => {
        const client = getWsClient();
        client.subscribe(channel, instId, (data: any) => {
          subscriber.next(data);
        });
        client.ws?.addEventListener('error', (err) => {
          subscriber.error(err);
        });
        client.ws?.addEventListener('close', () => {
          subscriber.error('WS Connection Closed');
        });
        subscriber.add(() => {
          client.unsubscribe(channel, instId);
        });
      }),
  ).pipe(
    // 防止单个连接断开导致数据流关闭
    timeout(60_000),
    tap({
      error: (err) => {
        console.info(formatTime(Date.now()), 'WS_SUBSCRIBE_ERROR', channel, instId, err);
      },
    }),
    // 暂时不太确定是否能支持 retry
    // retry({ delay: 1000 }),
    catchError(() => EMPTY),
  );

const swapInstruments$ = defer(() => client.getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);
const spotInstruments$ = defer(() => client.getInstruments({ instType: 'SPOT' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);

const spotTickers$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

// depend by SubmitOrders
export const spotMarketTickers$ = defer(() => spotTickers$).pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      map((x) => [x.instId, x] as const),
      toArray(),
      map((x) => Object.fromEntries(x)),
    ),
  ),
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const spotTicker$ = spotInstruments$.pipe(
  tap((x) => {
    console.info('SPOT INSTRUMENTS', x.length);
  }),
  listWatch(
    (x) => x.instId,
    (x) => fromWsChannelAndInstId('tickers', x.instId),
    () => true,
  ),
  share(),
);

const quoteOfSwapFromRest$ = defer(() => client.getMarketTickers({ instType: 'SWAP' })).pipe(
  mergeMap((x) => x.data || []),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath(x.instType, x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    }),
  ),
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
);

const quoteOfSpotAndMarginFromRest$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
  mergeMap((x) => x.data || []),
  mergeMap((x): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('SPOT', x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('MARGIN', x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    },
  ]),
  repeat({ delay: 1000 }),
  retry({ delay: 1000 }),
);

const quoteOfSwapFromWs$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => fromWsChannelAndInstId('tickers', x.instId),
    () => true,
  ),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', ticker.instId),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    }),
  ),
);

const quoteOfSpotAndMarginFromWs$ = spotTicker$.pipe(
  mergeMap((ticker): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('SPOT', ticker.instId),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('MARGIN', ticker.instId),
      last_price: ticker.last,
      ask_price: ticker.askPx,
      bid_price: ticker.bidPx,
      ask_volume: ticker.askSz,
      bid_volume: ticker.bidSz,
    },
  ]),
);

const swapOpenInterests$ = defer(() => client.getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const interestRateOfSwapFromWS$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => fromWsChannelAndInstId('open-interest', x.instId),
    () => true,
  ),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('SWAP', x.instId),
      open_interest: x.oi,
    }),
  ),
  share(),
);

const quoteSources$ = [
  quoteOfSwapFromWs$,
  interestRateOfSwapFromWS$,
  quoteOfSwapFromRest$,
  quoteOfSpotAndMarginFromWs$,
  quoteOfSpotAndMarginFromRest$,
];

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

// 合并不同来源的数据并进行合并，避免死锁
if (process.env.WRITE_QUOTE_TO_SQL === 'true') {
  Terminal.fromNodeEnv().channel.publishChannel('quote', { pattern: `^OKX/` }, (channel_id) => {
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
      writeToSQL({
        terminal: Terminal.fromNodeEnv(),
        writeInterval: 1000,
        tableName: 'quote',
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

export const swapOpenInterest$ = defer(() => swapOpenInterests$).pipe(
  map((x) => new Map(x.data.map((x: any) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
