import {
  IAccountInfo,
  IPosition,
  IProduct,
  ITick,
  PositionVariant,
  UUID,
  decodePath,
  encodePath,
  formatTime,
} from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import {
  EMPTY,
  catchError,
  combineLatest,
  defer,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  toArray,
} from 'rxjs';
import { OkxClient } from './api';

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || `okx/${UUID()}`,
  name: 'OKX',
});

const client = new OkxClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        public_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
        passphrase: process.env.PASSPHRASE!,
      },
});

const swapInstruments$ = defer(() => client.getInstruments({ instType: 'SWAP' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const usdtSwapProducts$ = swapInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      filter((x) => x.ctType === 'linear' && x.settleCcy === 'USDT'),
      map(
        (x): IProduct => ({
          datasource_id: 'OKX',
          product_id: encodePath(x.instType, x.instId),
          base_currency: x.ctValCcy,
          quote_currency: x.settleCcy,
          value_scale: +x.ctVal,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
        }),
      ),
      toArray(),
    ),
  ),
  shareReplay(1),
);

const marginInstruments$ = defer(() => client.getInstruments({ instType: 'MARGIN' })).pipe(
  repeat({ delay: 3600_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const marginProducts$ = marginInstruments$.pipe(
  mergeMap((x) =>
    from(x.data).pipe(
      //
      map(
        (x): IProduct => ({
          datasource_id: 'OKX',
          product_id: encodePath(x.instType, x.instId),
          base_currency: x.baseCcy,
          quote_currency: x.quoteCcy,
          value_scale: 1,
          volume_step: +x.lotSz,
          price_step: +x.tickSz,
          margin_rate: 1 / +x.lever,
        }),
      ),
      toArray(),
    ),
  ),
  shareReplay(1),
);

usdtSwapProducts$.pipe(delayWhen((products) => terminal.updateProducts(products))).subscribe((products) => {
  console.info(formatTime(Date.now()), 'SWAP Products updated', products.length);
});

marginProducts$.pipe(delayWhen((products) => terminal.updateProducts(products))).subscribe((products) => {
  console.info(formatTime(Date.now()), 'MARGIN Products updated', products.length);
});

const swapMarketTickers$ = defer(() => client.getMarketTickers({ instType: 'SWAP' })).pipe(
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

const spotMarketTickers$ = defer(() => client.getMarketTickers({ instType: 'SPOT' })).pipe(
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

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

const fundingRate$ = memoizeMap((product_id: string) =>
  defer(() => client.getFundingRate({ instId: decodePath(product_id)[1] })).pipe(
    mergeMap((x) => x.data),
    repeat({ delay: 5000 }),
    retry({ delay: 5000 }),
    shareReplay(1),
  ),
);

const interestRateLoanQuota$ = defer(() => client.getInterestRateLoanQuota()).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const interestRateByCurrency$ = memoizeMap((currency: string) =>
  interestRateLoanQuota$.pipe(
    mergeMap((x) =>
      from(x.data).pipe(
        mergeMap((x) => x.basic),
        filter((x) => x.ccy === currency),
        map((x) => +x.rate),
      ),
    ),
    shareReplay(1),
  ),
);

terminal.provideTicks('OKX', (product_id) => {
  const [instType, instId] = decodePath(product_id);
  if (instType === 'SWAP') {
    return defer(async () => {
      const products = await firstValueFrom(usdtSwapProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;
      const theTicker$ = swapMarketTickers$.pipe(
        map((x) => x[instId]),
        shareReplay(1),
      );
      return [of(theProduct), theTicker$, fundingRate$(product_id)] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(
            ([theProduct, ticker, fundingRate]): ITick => ({
              datasource_id: 'OKX',
              product_id,
              updated_at: Date.now(),
              settlement_scheduled_at: +fundingRate.fundingTime,
              price: +ticker.last,
              ask: +ticker.askPx,
              bid: +ticker.bidPx,
              volume: +ticker.lastSz,
              interest_rate_for_long: -+fundingRate.fundingRate * theProduct.value_scale! * +ticker.last, // TODO: 结算价
              interest_rate_for_short: +fundingRate.fundingRate * theProduct.value_scale! * +ticker.last, // TODO: 结算价
            }),
          ),
        ),
      ),
    );
  }
  if (instType === 'MARGIN') {
    return defer(async () => {
      const products = await firstValueFrom(marginProducts$);
      const theProduct = products.find((x) => x.product_id === product_id);
      if (!theProduct) throw `No Found ProductID ${product_id}`;
      const theTicker$ = spotMarketTickers$.pipe(
        map((x) => x[instId]),
        shareReplay(1),
      );
      return [
        of(theProduct),
        theTicker$,
        interestRateByCurrency$(theProduct.base_currency!),
        interestRateByCurrency$(theProduct.quote_currency!),
      ] as const;
    }).pipe(
      catchError(() => EMPTY),
      mergeMap((x) =>
        combineLatest(x).pipe(
          map(
            ([theProduct, ticker, interestRateForBase, interestRateForQuote]): ITick => ({
              datasource_id: 'OKX',
              product_id,
              updated_at: Date.now(),
              price: +ticker.last,
              volume: +ticker.lastSz,
              // 在下一个整点扣除利息 See 如何计算利息 https://www.okx.com/zh-hans/help/how-to-calculate-borrowing-interest
              settlement_scheduled_at: new Date().setMinutes(0, 0, 0) + 3600_000,
              interest_rate_for_long: (-interestRateForQuote / 24) * +ticker.last, // TODO: 结算价
              interest_rate_for_short: (-interestRateForBase / 24) * +ticker.last, // TODO: 结算价
            }),
          ),
        ),
      ),
    );
  }
  return EMPTY;
});

const accountPosition$ = defer(() => client.getAccountPositions({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const accountConfig$ = defer(() => client.getAccountConfig()).pipe(
  repeat({ delay: 10_000 }),
  retry({ delay: 10_000 }),
  shareReplay(1),
);

const accountUid$ = accountConfig$.pipe(
  map((x) => x.data[0].uid),
  filter((x) => !!x),
  shareReplay(1),
);

const accountBalance$ = defer(() => client.getAccountBalance({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const accountUsdtBalance$ = accountBalance$.pipe(
  map((x) => x.data[0]?.details.find((x) => x.ccy === 'USDT')),
  filter((x): x is Exclude<typeof x, undefined> => !!x),
  shareReplay(1),
);

const tradingAccountInfo$ = combineLatest([accountUid$, accountBalance$, accountPosition$]).pipe(
  map(([uid, balanceApi, positions]): IAccountInfo => {
    const usdtBalance = balanceApi.data[0]?.details.find((x) => x.ccy === 'USDT');
    const equity = +(usdtBalance?.eq ?? 0);
    const balance = +(usdtBalance?.cashBal ?? 0);
    const free = +(usdtBalance?.availEq ?? 0);
    const used = equity - free;
    // const used = +usdtBalance.frozenBal;
    const profit = equity - balance;

    return {
      account_id: `okx/${uid}/trading`,
      timestamp_in_us: Date.now() * 1000,
      updated_at: Date.now(),
      money: {
        currency: 'USDT',
        equity: equity,
        balance: balance,
        used,
        free,
        profit,
      },
      positions: positions.data.map((x): IPosition => {
        const direction =
          x.posSide === 'long' ? 'LONG' : x.posSide === 'short' ? 'SHORT' : +x.pos > 0 ? 'LONG' : 'SHORT';
        const variant = direction === 'LONG' ? PositionVariant.LONG : PositionVariant.SHORT;
        return {
          position_id: x.posId,
          product_id: encodePath(x.instType, x.instId),
          variant: variant,
          direction,
          volume: Math.abs(+x.pos),
          free_volume: +x.availPos,
          closable_price: +x.last,
          position_price: +x.avgPx,
          floating_profit: +x.upl,
          // margin: +x.posCcy,
          // liquidation_price: +x.liqPx,
          // leverage: +x.lever,
          // margin_rate: 1 / +x.lever,
        };
      }),
      orders: [],
    };
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(tradingAccountInfo$);

const assetBalance$ = defer(() => client.getAssetBalances({})).pipe(
  repeat({ delay: 1000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const fundingAccountInfo$ = combineLatest([accountUid$, assetBalance$]).pipe(
  map(([uid, assetBalances]): IAccountInfo => {
    const equity = +(assetBalances.data.find((x) => x.ccy === 'USDT')?.bal ?? '') || 0;
    const balance = equity;
    const free = equity;
    const used = 0;
    const profit = 0;

    return {
      account_id: `okx/${uid}/funding/USDT`,
      timestamp_in_us: Date.now() * 1000,
      updated_at: Date.now(),
      money: {
        currency: 'USDT',
        equity,
        balance,
        used,
        free,
        profit,
      },
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(fundingAccountInfo$);

const financeOrders$ = defer(() => client.getFinanceStakingDeFiOrdersActive({})).pipe(
  repeat({ delay: 5000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

const earningAccountInfo$ = combineLatest([accountUid$, financeOrders$]).pipe(
  map(([uid, offers]): IAccountInfo => {
    const equity = offers.data
      .filter((x) => x.ccy === 'USDT')
      .reduce((acc, x) => acc + +x.investData.reduce((acc, x) => acc + +x.amt, 0), 0);
    const balance = equity;
    const free = equity;
    const used = 0;
    const profit = 0;

    return {
      account_id: `okx/${uid}/earning/USDT`,
      timestamp_in_us: Date.now() * 1000,
      updated_at: Date.now(),
      money: {
        currency: 'USDT',
        equity,
        balance,
        used,
        free,
        profit,
      },
      positions: [],
      orders: [],
    };
  }),
  shareReplay(1),
);

terminal.provideAccountInfo(earningAccountInfo$);
