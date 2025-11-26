import { IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getUnifiedAccountBalance, getUnifiedUmAccount, ICredential } from '../../api/private-api';

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
      volume: +position.positionAmt,
      free_volume: +position.positionAmt,
      position_price: +position.entryPrice,
      closable_price: +position.entryPrice + +position.unrealizedProfit / +position.positionAmt,
      floating_profit: +position.unrealizedProfit,
      valuation:
        +position.positionAmt *
        (+position.entryPrice +
          (+position.positionAmt === 0 ? 0 : +position.unrealizedProfit / +position.positionAmt)),
    }));

  return positions;
};
