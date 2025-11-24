import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getFApiV4Account, ICredential } from '../../api/private-api';

export const getPerpAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const [a] = await Promise.all([getFApiV4Account(credential, {})]);

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
  return positions;
};
