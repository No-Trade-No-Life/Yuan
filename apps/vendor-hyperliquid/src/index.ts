import {
  addAccountMarket,
  IAccountInfo,
  IAccountMoney,
  IPosition,
  publishAccountInfo,
} from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, repeat, retry, shareReplay, tap } from 'rxjs';
import { client } from './api';
import './order';
import './product';
import { terminal } from './terminal';
import './interest_rate';

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

(async () => {
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
        positions: accountRes.assetPositions.map(
          (position): IPosition => ({
            position_id: `${position.position.coin}-USD`,
            datasource_id: 'HYPERLIQUID',
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
    publishAccountInfo(terminal, `Hyperliquid/${client.public_key}`, swapAccountInfo$);
    addAccountMarket(terminal, { account_id: `Hyperliquid/${client.public_key}`, market_id: 'Hyperliquid' });
  }

  // TODO: spot account info

  // TODO: funding rate

  // TODO: transfer
})();
