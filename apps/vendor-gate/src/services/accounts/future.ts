import type { IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getFuturePositions, getFuturesAccounts, ICredential } from '../../api/private-api';
import { productCache } from '../markets/product';

export const loadFuturePositions = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];
  const positionsRes = await getFuturePositions(credential, 'usdt');

  for (const position of Array.isArray(positionsRes) ? positionsRes : []) {
    if (!(Math.abs(position.size) > 0)) continue;

    const product_id = encodePath('GATE', 'FUTURE', position.contract);
    const theProduct = await productCache.query(product_id);
    const volume = Math.abs(position.size);
    const closable_price = Number(position.mark_price);
    const valuation = volume * closable_price * (theProduct?.value_scale ?? 1);
    positions.push({
      datasource_id: 'GATE',
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
      liquidation_price: position.liq_price,
      valuation,
    });
  }

  return positions;
};

export const getFutureAccountInfo = async (credential: ICredential) => {
  const [positions, rawAccount] = await Promise.all([
    loadFuturePositions(credential),
    getFuturesAccounts(credential, 'usdt'),
  ]);

  return positions;
};
