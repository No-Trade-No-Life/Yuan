import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getUnifiedAccountBalance, getUnifiedUmAccount, ICredential } from '../../api/private-api';
import { getSpotTickerPrice } from '../../api/public-api';

export const getUnifiedAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  const [balanceRes, umAccountRes] = await Promise.all([
    getUnifiedAccountBalance(credential),
    getUnifiedUmAccount(credential),
  ]);
  if (isApiError(balanceRes)) {
    throw new Error(balanceRes.msg);
  }
  if (isApiError(umAccountRes)) {
    throw new Error(umAccountRes.msg);
  }

  const positions: IPosition[] = umAccountRes.positions
    .filter((position) => +position.positionAmt !== 0)
    .map((position) => ({
      position_id: `${position.symbol}/${position.positionSide}`,
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', position.symbol),
      direction:
        position.positionSide === 'LONG'
          ? 'LONG'
          : position.positionSide === 'SHORT'
          ? 'SHORT'
          : position.positionSide === 'BOTH'
          ? 'BOTH'
          : 'UNKNOWN',
      volume: Math.abs(+position.positionAmt),
      free_volume: Math.abs(+position.positionAmt),
      position_price: +position.entryPrice,
      // ISSUE: positionAmt 有正负，这里计算有个 trick，不需要区分仓位方向
      closable_price: +position.entryPrice + +position.unrealizedProfit / +position.positionAmt,
      floating_profit: +position.unrealizedProfit,
      valuation:
        +position.positionAmt *
        (+position.entryPrice +
          (+position.positionAmt === 0 ? 0 : +position.unrealizedProfit / +position.positionAmt)),
    }));

  const prices = await getSpotTickerPrice({
    symbols: JSON.stringify([
      ...new Set([
        ...balanceRes
          .map((balance) => {
            const match = balance.asset.match(/^LD(\w+)$/);
            let symbol = balance.asset;
            if (match) {
              symbol = match[1];
            }
            if (symbol === 'USDT') return '';
            return `${symbol}USDT`;
          })
          .filter(Boolean),
      ]),
    ]),
  });
  const balancePositions: IPosition[] = balanceRes.map((position) =>
    makeSpotPosition({
      position_id: `UNIFIED-SPOT/${position.asset}`,
      datasource_id: 'BINANCE',
      product_id: encodePath('BINANCE', 'UNIFIED-SPOT', position.asset),
      volume: +position.totalWalletBalance + +position.umUnrealizedPNL,
      free_volume: +position.crossMarginFree,
      closable_price:
        position.asset === 'USDT'
          ? 1
          : Array.isArray(prices)
          ? +(prices.find((item) => item.symbol === `${position.asset}USDT`)?.price ?? 0)
          : 0,
    }),
  );
  return [...balancePositions, ...positions];
};
