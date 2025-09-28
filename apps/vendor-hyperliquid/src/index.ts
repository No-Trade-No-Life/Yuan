import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { client } from './api';
import './interest_rate';
import './order';
import './product';

const terminal = Terminal.fromNodeEnv();

(async () => {
  // swap account info
  {
    const account_id = `Hyperliquid/${client.public_key}`;

    provideAccountInfoService(
      terminal,
      account_id,
      async () => {
        const accountRes = await client.getUserPerpetualsAccountSummary({
          user: client.public_key!,
        });

        const equity = +accountRes.crossMarginSummary.accountValue;
        const free = +accountRes.withdrawable;

        return {
          money: {
            currency: 'USDC',
            equity,
            free,
          },
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
        };
      },
      { auto_refresh_interval: 1000 },
    );

    addAccountMarket(terminal, { account_id: `Hyperliquid/${client.public_key}`, market_id: 'Hyperliquid' });
  }

  // TODO: spot account info

  // TODO: funding rate

  // TODO: transfer
})();
