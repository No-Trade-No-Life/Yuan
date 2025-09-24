import { IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { getApiV1Account, getApiV1TickerPrice } from './sapi';

const ADDRESS = process.env.ADDRESS!;
export const SPOT_ACCOUNT_ID = `ASTER/${ADDRESS}/SPOT`;

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  SPOT_ACCOUNT_ID,
  async () => {
    const [x, prices] = await Promise.all([getApiV1Account({}), getApiV1TickerPrice({})]);

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
    const balance = usdtAsset ? +usdtAsset.free + +usdtAsset.locked : 0;
    const profit = equity - balance;
    const used = equity - free;

    return {
      money: {
        currency: 'USDT',
        equity,
        balance,
        profit,
        free,
        used,
      },
      positions,
    };
  },
  { auto_refresh_interval: 1000 },
);
