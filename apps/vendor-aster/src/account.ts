import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { defer } from 'rxjs';
import { getFApiV4Account } from './api/private-api';
import { getDefaultCredential } from './api/client';
import { getPerpetualAccountId } from './account-profile';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getPerpetualAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'ASTER/PERP' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const a = await getFApiV4Account(credential);

      const equity = +a.totalWalletBalance + +a.totalUnrealizedProfit;
      const free = +a.availableBalance;

      const positions = a.positions
        .filter((p) => +p.positionAmt !== 0)
        .map(
          (p): IPosition => ({
            position_id: p.symbol,
            product_id: encodePath('PERPETUAL', p.symbol),
            datasource_id: 'ASTER',
            direction: p.positionSide === 'BOTH' ? (+p.positionAmt > 0 ? 'LONG' : 'SHORT') : p.positionSide,
            volume: Math.abs(+p.positionAmt),
            free_volume: Math.abs(+p.positionAmt),
            position_price: +p.entryPrice,
            closable_price: Math.abs(+p.notional / +p.positionAmt),
            floating_profit: +p.unrealizedProfit,
            valuation: Math.abs(+p.notional),
          }),
        );
      return {
        money: {
          currency: 'USD',
          equity,
          free,
        },
        positions,
      };
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();
