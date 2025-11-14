import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { getApiV1Account } from './api/private-api';
import { getApiV1TickerPrice } from './api/public-api';
import { getDefaultCredential } from './api/client';
import { defer } from 'rxjs';
import { getSpotAccountId } from './account-profile';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getSpotAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'ASTER/SPOT' });

  provideAccountInfoService(
    terminal,
    accountId,
    async () => {
      const [x, prices] = await Promise.all([getApiV1Account(credential), getApiV1TickerPrice()]);

      const positions = x.balances.map((b): IPosition => {
        const thePrice = b.asset === 'USDT' ? 1 : prices.find((p) => p.symbol === b.asset + 'USDT')?.price ?? 0;

        const volume = +b.free + +b.locked;

        const position_price = +thePrice;
        const closable_price = +thePrice;
        const valuation = volume * closable_price;
        const floating_profit = 0;

        return {
          position_id: b.asset,
          datasource_id: 'ASTER',
          product_id: b.asset,
          direction: 'LONG',
          volume,
          free_volume: +b.free,
          position_price,
          closable_price,
          floating_profit,
          valuation,
        };
      });

      const usdtAsset = x.balances.find((b) => b.asset === 'USDT');
      const equity = positions.reduce((a, b) => a + b.valuation, 0);
      const free = usdtAsset ? +usdtAsset.free : 0;

      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions,
      };
    },
    { auto_refresh_interval: 1000 },
  );
}).subscribe();
