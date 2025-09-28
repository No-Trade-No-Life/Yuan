import { IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { getFApiV4Account } from './api';

const ADDRESS = process.env.ADDRESS!;
export const ACCOUNT_ID = `ASTER/${ADDRESS}`;

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  ACCOUNT_ID,
  async () => {
    const [a] = await Promise.all([getFApiV4Account({})]);

    const equity = +a.totalWalletBalance + +a.totalUnrealizedProfit;
    const free = +a.availableBalance;

    const positions = a.positions
      .filter((p) => +p.positionAmt !== 0)
      .map(
        (p): IPosition => ({
          position_id: p.symbol,
          product_id: p.symbol,
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
