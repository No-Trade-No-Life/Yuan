import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime, listWatch } from '@yuants/utils';
import {
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  EMPTY,
  filter,
  first,
  firstValueFrom,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  reduce,
  repeat,
  retry,
  scan,
  share,
  shareReplay,
  switchMap,
  tap,
  toArray,
} from 'rxjs';
import { getInstruments, getMarketTickers, getOpenInterest, getPositionTiers } from '../api/public-api';
import { useFundingRate, useOpenInterest, useTicker } from '../ws';

const terminal = Terminal.fromNodeEnv();

const swapInstruments$ = defer(() => getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);
const spotInstruments$ = defer(() => getInstruments({ instType: 'SPOT' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  map((x) => x.data),
  shareReplay(1),
);

const shallowEqual = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

const spotInstIds$ = spotInstruments$.pipe(
  map((items) => items.map((item) => item.instId)),
  distinctUntilChanged(shallowEqual),
  shareReplay(1),
);

const spotTickers$ = defer(() => getMarketTickers({ instType: 'SPOT' })).pipe(
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
    (x) => useTicker(x.instId),
    () => true,
  ),
  share(),
);

const quoteOfSwapFromRest$ = defer(() => getMarketTickers({ instType: 'SWAP' })).pipe(
  mergeMap((x) => x.data || []),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('OKX', x.instType, x.instId),
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

const quoteOfSpotAndMarginFromRest$ = defer(() => getMarketTickers({ instType: 'SPOT' })).pipe(
  mergeMap((x) => x.data || []),
  mergeMap((x): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SPOT', x.instId),
      last_price: x.last,
      ask_price: x.askPx,
      bid_price: x.bidPx,
      ask_volume: x.askSz,
      bid_volume: x.bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'MARGIN', x.instId),
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
    (x) => useTicker(x.instId),
    () => true,
  ),
  map(
    (ticker): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SWAP', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    }),
  ),
);

const quoteOfSpotAndMarginFromWs$ = spotTicker$.pipe(
  mergeMap((ticker): Partial<IQuote>[] => [
    {
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SPOT', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    },
    {
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'MARGIN', ticker[0].instId),
      last_price: ticker[0].last,
      ask_price: ticker[0].askPx,
      bid_price: ticker[0].bidPx,
      ask_volume: ticker[0].askSz,
      bid_volume: ticker[0].bidSz,
    },
  ]),
);

const swapOpenInterests$ = defer(() => getOpenInterest({ instType: 'SWAP' })).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const openInterestOfSwapFromWS$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => useOpenInterest(x.instId),
    () => true,
  ),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SWAP', x[0].instId),
      open_interest: x[0].oi,
    }),
  ),
  share(),
);

const interestRateOfSwapFromWS$ = swapInstruments$.pipe(
  listWatch(
    (x) => x.instId,
    (x) => useFundingRate(x.instId),
    () => true,
  ),
  map(
    (x): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SWAP', x[0].instId),
      interest_rate_long: `${-+x[0].fundingRate}`,
      interest_rate_short: x[0].fundingRate,
      interest_rate_next_settled_at: x[0].fundingTime,
    }),
  ),
  share(),
);

type PositionTiersResponse = Awaited<ReturnType<typeof getPositionTiers>>;
type PositionTiersEntry = PositionTiersResponse['data'];

const marginPositionTiersMap$ = defer(() =>
  spotInstIds$.pipe(
    first(),
    map((instIds) => instIds.filter((id) => id.endsWith('USDT') || id.endsWith('USDC'))),
    switchMap((instIds) => {
      const total = instIds.length;
      let processed = 0;
      return from(instIds).pipe(
        concatMap((instId) =>
          defer(async () => {
            const tiers = await terminal.client.requestForResponseData<
              { instType: string; tdMode: string; instId: string },
              PositionTiersResponse
            >('OKX/PositionTiers', {
              instType: 'MARGIN',
              tdMode: 'cross',
              instId,
            });
            if (!tiers?.data) {
              throw new Error(`Failed to load position tiers for ${instId}: ${tiers.msg}`);
            }
            return {
              instId,
              tiers,
            };
          }).pipe(retry({ delay: 2000 })),
        ),
        reduce((map, { instId, tiers }) => {
          processed += 1;
          console.info(
            formatTime(Date.now()),
            `Loaded margin position tiers ${processed}/${total} (${instId})`,
          );
          if (tiers?.data) {
            map.set(instId, tiers.data);
          }
          return map;
        }, new Map<string, PositionTiersEntry>()),
      );
    }),
  ),
).pipe(
  //
  retry({ delay: 60_000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

// Margin 的 open interest 只依赖 position-tier：
// 1) 启动时先拉全量 MARGIN 仓位档位并缓存，下次直接命中；
// 2) 档位内只保留同 tier 杠杆最高的记录；
// 3) 当前策略只使用 tier=1 的 quoteMaxLoan 作为持仓上限，不再混合 /account/max-size；
// 4) 每个 instId 60 秒刷新一次，并在接口报错时 10 秒重试。
const marginOpenInterest$ = spotInstIds$.pipe(
  mergeMap((instIds) =>
    from(instIds).pipe(
      mergeMap((instId) =>
        defer(async () => {
          const tiersMap = await firstValueFrom(marginPositionTiersMap$);
          const tiers = tiersMap.get(instId);
          if (!tiers?.length) {
            return null;
          }

          const tierByLevel = tiers
            .filter((tier) => !tier.instId || tier.instId === instId)
            .reduce((mapTierToTierInfo, tierInfo) => {
              const existing = mapTierToTierInfo.get(tierInfo.tier);
              if (!existing || +tierInfo.maxLever > +existing.maxLever) {
                mapTierToTierInfo.set(tierInfo.tier, tierInfo);
              }
              return mapTierToTierInfo;
            }, new Map<string, (typeof tiers)[number]>());
          // 获取一级杠杆的最大可借贷额度作为持仓量
          const openInterest = +(tierByLevel.get('1')?.quoteMaxLoan || 0);

          return {
            instId,
            openInterest,
          };
        }).pipe(retry({ delay: 10_000 }), repeat({ delay: 60_000 })),
      ),
    ),
  ),
  filter((result): result is { instId: string; openInterest: number } => result !== null),
  map(({ instId, openInterest }) => {
    const partial: Partial<IQuote> = {
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'MARGIN', instId),
    };
    if (typeof openInterest === 'number' && Number.isFinite(openInterest)) {
      partial.open_interest = `${openInterest}`;
    }
    return partial;
  }),
  share(),
);

marginOpenInterest$.subscribe();

const quoteSources$ = [
  quoteOfSwapFromWs$,
  openInterestOfSwapFromWS$,
  quoteOfSwapFromRest$,
  quoteOfSpotAndMarginFromWs$,
  quoteOfSpotAndMarginFromRest$,
  marginOpenInterest$,
  interestRateOfSwapFromWS$,
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
  terminal.channel.publishChannel('quote', { pattern: `^OKX/` }, (channel_id) => {
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
        terminal,
        writeInterval: 1000,
        tableName: 'quote',
        conflictKeys: ['datasource_id', 'product_id'],
      }),
    )
    .subscribe();
}

export const swapOpenInterest$ = defer(() => swapOpenInterests$).pipe(
  map((x) => new Map(x.data.map((x) => [x.instId, +x.oi] as const))),
  shareReplay(1),
);
