import {
  IAccountInfo,
  IAccountMoney,
  IPosition,
  IProduct,
  UUID,
  encodePath,
  formatTime,
  getDataRecordWrapper,
} from '@yuants/data-model';
import { Terminal, provideAccountInfo, writeDataRecords } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';
import { defer, delayWhen, from, map, merge, repeat, retry, shareReplay, tap } from 'rxjs';
import { HyperliquidClient } from './api';

const DATASOURCE_ID = 'Hyperliquid';

const client = new HyperliquidClient({
  auth: process.env.PUBLIC_ONLY
    ? undefined
    : {
        private_key: process.env.PRIVATE_KEY!,
      },
});

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

(async () => {
  const terminal = new Terminal(process.env.HOST_URL!, {
    terminal_id: process.env.TERMINAL_ID || `hyperliquid/${client.public_key}/${UUID()}`,
    name: 'Hyperliquid',
  });

  const tokenProduct$ = defer(async () => {
    const res = await client.getSpotMetaData();
    return res.tokens.map(
      (token): IProduct => ({
        product_id: encodePath('SPOT', `${token.name}-USDC`),
        datasource_id: DATASOURCE_ID,
        quote_currency: 'USDC',
        base_currency: token.name,
        price_step: 1e-2,
        volume_step: Number(`1e-${token.szDecimals}`),
      }),
    );
  }).pipe(
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'SpotProducts', e);
      },
    }),
    retry({ delay: 5000 }),
    repeat({ delay: 86400_000 }),
    shareReplay(1),
  );

  const perpetualProduct$ = defer(async () => {
    const res = await client.getPerpetualsMetaData();
    return res.universe.map(
      (product): IProduct => ({
        product_id: encodePath('PERPETUAL', `${product.name}-USDC`),
        datasource_id: DATASOURCE_ID,
        quote_currency: 'USD',
        base_currency: product.name,
        price_step: 1e-2,
        volume_step: Number(`1e-${product.szDecimals}`),
      }),
    );
  }).pipe(
    tap({
      error: (e) => {
        console.error(formatTime(Date.now()), 'PerpetualProducts', e);
      },
    }),
    retry({ delay: 5000 }),
    repeat({ delay: 86400_000 }),
    shareReplay(1),
  );

  merge(tokenProduct$, perpetualProduct$)
    .pipe(
      //
      delayWhen((products) =>
        from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!))),
      ),
    )
    .subscribe((products) => {
      console.info(formatTime(Date.now()), 'FUTUREProductsUpdated', products.length);
    });

  const mapProductIdToFuturesProduct$ = merge(tokenProduct$, perpetualProduct$).pipe(
    //
    map((products) => new Map(products.map((v) => [v.product_id, v]))),
    shareReplay(1),
  );

  // swap account info
  {
    const swapAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const accountRes = await client.getUserPerpetualsAccountSummary({
        user: client.public_key!,
      });

      const profit = accountRes.assetPositions
        .map((pos) => +pos.position.unrealizedPnl)
        .reduce((a, b) => a + b, 0);

      const money: IAccountMoney = {
        currency: 'USDC',
        equity: +accountRes.crossMarginSummary.accountValue,
        profit: profit,
        free: +accountRes.withdrawable,
        used: +accountRes.crossMarginSummary.accountValue - +accountRes.withdrawable,
        balance: +accountRes.crossMarginSummary.accountValue - profit,
      };

      return {
        account_id: `Hyperliquid/${client.public_key}`,
        money: money,
        currencies: [money],
        positions: accountRes.assetPositions.map(
          (position): IPosition => ({
            position_id: `${position.position.coin}-USD`,
            datasource_id: DATASOURCE_ID,
            product_id: encodePath('PERPETUAL', `${position.position.coin}-USD`),
            direction: +position.position.szi > 0 ? 'LONG' : 'SHORT',
            volume: Math.abs(+position.position.szi),
            free_volume: Math.abs(+position.position.szi),
            position_price: +position.position.entryPx,
            closable_price: Math.abs(+position.position.positionValue / +position.position.szi),
            floating_profit: +position.position.unrealizedPnl,
            valuation: +position.position.positionValue,
            margin: +position.position.marginUsed,
          }),
        ),
        orders: [],
        updated_at: Date.now(),
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'PerpetualAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );
    provideAccountInfo(terminal, swapAccountInfo$);
  }

  // TODO: spot account info

  // TODO: trade api

  // TODO: funding rate

  // TODO: transfer
})();
