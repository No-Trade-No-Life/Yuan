import {
  IAccountInfo,
  IPosition,
  IProduct,
  ITick,
  UUID,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { Terminal, provideAccountInfo, provideTicks, wrapProduct, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import {
  EMPTY,
  combineLatest,
  defer,
  delayWhen,
  filter,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
} from 'rxjs';
import { BitgetClient } from './api';

const DATASOURCE_ID = 'Bitget';

const client = new BitgetClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        access_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
        passphrase: process.env.PASSPHRASE!,
      },
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const fundingTime$ = memoizeMap((product_id: string) =>
  defer(async () => {
    const [instType, instId] = decodePath(product_id);
    const res = await client.getNextFundingTime({
      symbol: instId,
      productType: instType,
    });
    if (res.msg !== 'success') {
      throw new Error(res.msg);
    }
    return res.data;
  }).pipe(
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'FundingTime', e);
      },
    }),
    retry({ delay: 5000 }),
    repeat({ delay: 5000 }),
    shareReplay(1),
  ),
);

(async () => {
  const accountInfoRes = await client.getAccountInfo();
  const uid = accountInfoRes.data.userId;
  const parentId = '' + accountInfoRes.data.parentId;

  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `bitget/${uid}/${UUID()}`,
    name: 'OKX',
  });

  // product
  {
    const futureProducts$ = defer(async () => {
      // usdt-m swap
      const usdtFuturesProductRes = await client.getMarketContracts({ productType: 'USDT-FUTURES' });
      if (usdtFuturesProductRes.msg !== 'success') {
        throw new Error(usdtFuturesProductRes.msg);
      }
      // mixed-coin swap, (including coin-m and coin-f)
      const coinFuturesProductRes = await client.getMarketContracts({ productType: 'COIN-FUTURES' });
      if (coinFuturesProductRes.msg !== 'success') {
        throw new Error(coinFuturesProductRes.msg);
      }
      const usdtFutures = usdtFuturesProductRes.data.map(
        (product): IProduct => ({
          product_id: encodePath(`USDT-FUTURES`, product.symbol),
          datasource_id: DATASOURCE_ID,
          quote_currency: product.quoteCoin,
          base_currency: product.baseCoin,
          price_step: Math.pow(10, -product.pricePlace),
          volume_step: +product.sizeMultiplier,
          max_position: +product.maxPositionNum,
          max_volume: +product.maxProductOrderNum,
        }),
      );
      const coinFutures = coinFuturesProductRes.data.map(
        (product): IProduct => ({
          product_id: encodePath(`COIN-FUTURES`, product.symbol),
          datasource_id: DATASOURCE_ID,
          quote_currency: product.quoteCoin,
          base_currency: product.baseCoin,
          price_step: Math.pow(10, -product.pricePlace),
          volume_step: +product.sizeMultiplier,
          max_position: +product.maxPositionNum,
          max_volume: +product.maxProductOrderNum,
        }),
      );

      return [...usdtFutures, ...coinFutures];
    }).pipe(
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'FuturesProducts', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 86400_000 }),
      shareReplay(1),
    );

    futureProducts$
      .pipe(delayWhen((products) => writeDataRecords(terminal, products.map(wrapProduct))))
      .subscribe((products) => {
        console.info(formatTime(Date.now()), 'FUTUREProductsUpdated', products.length);
      });

    // TODO: margin products
  }

  // ticks
  {
    const futureTickers$ = defer(async () => {
      const usdtFuturesTickersRes = await client.getFutureMarketTickers({
        productType: 'USDT-FUTURES',
      });
      if (usdtFuturesTickersRes.msg !== 'success') {
        throw new Error(usdtFuturesTickersRes.msg);
      }
      const coinFuturesTickersRes = await client.getFutureMarketTickers({
        productType: 'COIN-FUTURES',
      });
      if (coinFuturesTickersRes.msg !== 'success') {
        throw new Error(coinFuturesTickersRes.msg);
      }

      const usdtFuturesTickers = usdtFuturesTickersRes.data.map((v) => [
        encodePath('USDT-FUTURES', v.symbol),
        v,
      ]);
      const coinFuturesTickers = coinFuturesTickersRes.data.map((v) => [
        encodePath('COIN-FUTURES', v.symbol),
        v,
      ]);

      return Object.fromEntries([...usdtFuturesTickers, ...coinFuturesTickers]);
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'FuturesTickers', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 5000 }),
      shareReplay(1),
    );

    provideTicks(terminal, DATASOURCE_ID, (product_id: string) => {
      const [instType] = decodePath(product_id);
      if (!['USDT-FUTURES', 'COIN-FUTURES'].includes(instType)) {
        // TODO: margin
        return EMPTY;
      }
      return defer(async () => {
        const theTicker$ = futureTickers$.pipe(
          //
          map((v) => v[product_id]),
          filter((v) => v !== undefined),
          shareReplay(1),
        );
        return [theTicker$, fundingTime$(product_id)] as const;
      }).pipe(
        //
        mergeMap((v) =>
          combineLatest(v).pipe(
            map(([ticker, fundingTime]): ITick => {
              return {
                datasource_id: DATASOURCE_ID,
                product_id,
                updated_at: Date.now(),
                price: +ticker.lastPr,
                volume: +ticker.baseVolume,
                open_interest: +ticker.holdingAmount,
                ask: +ticker.askPr,
                bid: +ticker.bidPr,
                settlement_scheduled_at: new Date(+fundingTime.nextFundingTime).getTime(),
                interest_rate_for_long: -+ticker.fundingRate,
                interest_rate_for_short: +ticker.fundingRate,
              };
            }),
          ),
        ),
      );
    });
  }

  // swap account info
  {
    const swapAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const balanceRes = await client.getFutureAccounts({ productType: 'USDT-FUTURES' });
      if (balanceRes.msg !== 'success') {
        throw new Error(balanceRes.msg);
      }
      const positionsRes = await client.getAllPositions({ productType: 'USDT-FUTURES', marginCoin: 'USDT' });
      if (positionsRes.msg !== 'success') {
        throw new Error(positionsRes.msg);
      }

      return {
        account_id: `bitget/${uid}/futures`,
        money: {
          currency: 'USDT',
          equity: +balanceRes.data[0].accountEquity,
          profit: +balanceRes.data[0].unrealizedPL,
          free: +balanceRes.data[0].crossedMaxAvailable,
          used: +balanceRes.data[0].accountEquity - +balanceRes.data[0].crossedMaxAvailable,
          balance: +balanceRes.data[0].accountEquity - +balanceRes.data[0].unrealizedPL,
        },
        positions: positionsRes.data.map(
          (position): IPosition => ({
            position_id: `${position.symbol}-${position.holdSide}`,
            datasource_id: DATASOURCE_ID,
            product_id: encodePath('USDT-FUTURES', position.symbol),
            direction: position.holdSide === 'long' ? 'LONG' : 'SHORT',
            volume: +position.total,
            free_volume: +position.available,
            position_price: +position.openPriceAvg,
            closable_price: +position.markPrice,
            floating_profit: +position.unrealizedPL,
            valuation: 0,
          }),
        ),
        orders: [],
        updated_at: Date.now(),
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'SwapAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );
    provideAccountInfo(terminal, swapAccountInfo$);
  }
})();
