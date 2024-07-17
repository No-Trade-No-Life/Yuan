import {
  IAccountInfo,
  IAccountMoney,
  IDataRecordTypes,
  IPosition,
  IProduct,
  ITick,
  UUID,
  decodePath,
  encodePath,
  formatTime,
  getDataRecordWrapper,
} from '@yuants/data-model';
import { Terminal, provideAccountInfo, provideTicks, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  combineLatest,
  defer,
  firstValueFrom,
  from,
  interval,
  lastValueFrom,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { ApiClient, isError } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `binance/${UUID()}`,
  name: 'Binance API',
});

const client = new ApiClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        public_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
      },
});

const futureExchangeInfo$ = defer(() => client.getFutureExchangeInfo()).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 60_000 }),
  shareReplay(1),
);

const futureProducts$ = futureExchangeInfo$.pipe(
  mergeMap((x) =>
    from(x.symbols).pipe(
      //
      map((symbol): IProduct => {
        return {
          datasource_id: 'binance/future',
          product_id: symbol.symbol,
          base_currency: symbol.baseAsset,
          quote_currency: symbol.quoteAsset,
          price_step: +`1e-${symbol.pricePrecision}`,
          value_scale: 1,
          volume_step: +`1e-${symbol.quantityPrecision}`,
        };
      }),
      toArray(),
    ),
  ),
  shareReplay(1),
);

const mapProductIdToFutureProduct$ = futureProducts$.pipe(
  map((products) => new Map(products.map((v) => [v.product_id, v]))),
  shareReplay(1),
);

futureProducts$
  .pipe(mergeMap((products) => writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!))))
  .subscribe();

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

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
  shareReplay(1),
);

provideTicks(terminal, 'binance/future', (product_id) => {
  return combineLatest([
    mapSymbolToFuturePremiumIndex$,
    defer(() => client.getFutureOpenInterest({ symbol: product_id })).pipe(
      map((v) => +v.openInterest || 0),
      retry({ delay: 30_000 }),
      repeat({ delay: 30_000 }),
      shareReplay(1),
    ),
  ]).pipe(
    map(([mapSymbolToFuturePremiumIndex, openInterestVolume]): ITick => {
      const premiumIndex = mapSymbolToFuturePremiumIndex.get(product_id);
      if (!premiumIndex) {
        throw new Error(`Premium Index Not Found: ${product_id}`);
      }
      return {
        datasource_id: 'binance/future',
        product_id,
        updated_at: Date.now(),
        price: +premiumIndex.markPrice,
        interest_rate_for_long: -+premiumIndex.lastFundingRate,
        interest_rate_for_short: +premiumIndex.lastFundingRate,
        settlement_scheduled_at: premiumIndex.nextFundingTime,
        open_interest: openInterestVolume,
      };
    }),
  );
});

(async () => {
  const spotAccountInfo = await client.getSpotAccountInfo();
  if (isError(spotAccountInfo)) {
    throw new Error(spotAccountInfo.msg);
  }
  const uid = spotAccountInfo.uid;

  {
    // accountInfo
    const unifiedAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const accountResult = await client.getUnifiedAccountBalance();
      if (isError(accountResult)) {
        throw new Error(accountResult.msg);
      }
      const usdtAssets = accountResult.find((v) => v.asset === 'USDT');
      if (!usdtAssets) {
        throw new Error('USDT not found');
      }
      const umAccountResult = await client.getUnifiedUmAccount();
      if (isError(umAccountResult)) {
        throw new Error(umAccountResult.msg);
      }
      const usdtUmAssets = umAccountResult.assets.find((v) => v.asset === 'USDT');
      if (!usdtUmAssets) {
        throw new Error('um USDT not found');
      }
      const money: IAccountMoney = {
        currency: 'USDT',
        leverage: 1,
        equity: +usdtAssets.totalWalletBalance + +usdtAssets.umUnrealizedPNL,
        balance: +usdtAssets.totalWalletBalance,
        profit: +usdtAssets.umUnrealizedPNL,
        used: +usdtUmAssets.initialMargin,
        free: +usdtAssets.totalWalletBalance + +usdtAssets.umUnrealizedPNL - +usdtUmAssets.initialMargin,
      };

      const positions = umAccountResult.positions
        .filter((v) => +v.positionAmt !== 0)
        .map((v): IPosition => {
          return {
            position_id: `${v.symbol}/${v.positionSide}`,
            datasource_id: `binance/future`,
            product_id: v.symbol,
            direction: v.positionSide,
            volume: +v.positionAmt,
            free_volume: +v.positionAmt,
            position_price: +v.entryPrice,
            closable_price: +v.entryPrice + +v.unrealizedProfit / +v.positionAmt,
            floating_profit: +v.unrealizedProfit,
            valuation: +v.positionAmt * (+v.entryPrice + +v.unrealizedProfit / +v.positionAmt),
          };
        });

      return {
        updated_at: Date.now(),
        account_id: `binance/${uid}/unified/usdt`,
        money,
        currencies: [money],
        positions,
        orders: [],
      };
    }).pipe(
      tap({
        error: (err) => {
          console.error(formatTime(Date.now()), 'unifiedAccountInfo$', err);
        },
      }),
      retry(5000),
      repeat(1000),
    );
    provideAccountInfo(terminal, unifiedAccountInfo$);
  }
})();

defer(async () => {
  terminal.provideService(
    'CopyDataRecords',
    {
      required: ['type', 'tags'],
      properties: {
        type: { const: 'funding_rate' },
        tags: {
          type: 'object',
          required: ['series_id'],
          properties: {
            series_id: { type: 'string', pattern: '^binance/' },
          },
        },
      },
    },
    (msg, output$) => {
      const sub = interval(5000).subscribe(() => {
        output$.next({});
      });
      return defer(async () => {
        if (msg.req.tags?.series_id === undefined) {
          return { res: { code: 400, message: 'series_id is required' } };
        }
        const [start, end] = msg.req.time_range || [0, Date.now()];
        const [datasource_id, product_id] = decodePath(msg.req.tags.series_id);
        const mapProductIdToFutureProduct = await firstValueFrom(mapProductIdToFutureProduct$);
        const theProduct = mapProductIdToFutureProduct.get(product_id);
        if (!theProduct) {
          return { res: { code: 404, message: 'product not found' } };
        }
        const { base_currency, quote_currency } = theProduct;
        if (!base_currency || !quote_currency) {
          return { res: { code: 400, message: 'base_currency and quote_currency is required' } };
        }
        const funding_rate_history: IDataRecordTypes['funding_rate'][] = [];
        let current_start = start;
        while (true) {
          const res = await client.getFutureFundingRate({
            symbol: product_id,
            startTime: current_start,
            endTime: end,
            limit: 1000,
          });
          res.forEach((v) => {
            funding_rate_history.push({
              datasource_id,
              product_id,
              base_currency,
              quote_currency,
              series_id: msg.req.tags!.series_id,
              funding_at: v.fundingTime,
              funding_rate: +v.fundingRate,
            });
          });
          if (res.length < 1000) {
            break;
          }
          current_start = +res[res.length - 1].fundingTime;
          await firstValueFrom(timer(1000));
        }
        funding_rate_history.sort((a, b) => +a.funding_at - +b.funding_at);
        // there will be at most 300 records, so we don't need to chunk it by bufferCount
        await lastValueFrom(
          from(funding_rate_history).pipe(
            map(getDataRecordWrapper('funding_rate')!),
            toArray(),
            mergeMap((v) => writeDataRecords(terminal, v)),
          ),
        );
        return { res: { code: 0, message: 'OK' } };
      }).pipe(
        //
        tap({
          finalize: () => {
            console.info(
              formatTime(Date.now()),
              `CopyDataRecords`,
              `series_id=${msg.req.tags?.series_id} finalized`,
            );
            sub.unsubscribe();
          },
        }),
      );
    },
    { concurrent: 10 },
  );
}).subscribe();
