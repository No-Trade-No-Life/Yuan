import type { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { firstValueFrom } from 'rxjs';
import { getFuturePositions, getFuturesAccounts, ICredential } from '../../api/private-api';
import { mapProductIdToUsdtFutureProduct$ } from '../markets/product';

export const loadFuturePositions = async (credential: ICredential): Promise<IPosition[]> => {
  const [positionsRes, productMap] = await Promise.all([
    getFuturePositions(credential, 'usdt'),
    firstValueFrom(mapProductIdToUsdtFutureProduct$),
  ]);
  const positions = Array.isArray(positionsRes) ? positionsRes : [];
  return positions.map((position): IPosition => {
    const product_id = position.contract;
    const theProduct = productMap.get(product_id);
    const volume = Math.abs(position.size);
    const closable_price = Number(position.mark_price);
    const valuation = volume * closable_price * (theProduct?.value_scale ?? 1);
    return {
      datasource_id: 'GATE-FUTURE',
      position_id: `${position.contract}-${position.leverage}-${position.mode}`,
      product_id,
      direction:
        position.mode === 'dual_long'
          ? 'LONG'
          : position.mode === 'dual_short'
          ? 'SHORT'
          : position.size > 0
          ? 'LONG'
          : 'SHORT',
      volume,
      free_volume: Math.abs(position.size),
      position_price: Number(position.entry_price),
      closable_price,
      floating_profit: Number(position.unrealised_pnl),
      valuation,
    };
  });
};

export const getFutureAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const [positions, rawAccount] = await Promise.all([
    loadFuturePositions(credential),
    getFuturesAccounts(credential, 'usdt'),
  ]);

  return positions;
};
