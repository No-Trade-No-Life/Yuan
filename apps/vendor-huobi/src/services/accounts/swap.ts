import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import {
  getSwapCrossPositionInfo,
  getUnifiedAccountInfo,
  getUnionAccountBalance,
  getUnionAccountPositions,
  ICredential,
} from '../../api/private-api';
import { productCache } from '../product';

const usdAssets = new Set(['USDT', 'USDC', 'USDD']);

export const getSwapAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];
  // balance
  const balance = await getUnifiedAccountInfo(credential);
  if (!balance.data) {
    throw new Error('Failed to get unified account info');
  }

  for (const v of balance.data || []) {
    if (v.margin_balance === 0) continue;
    positions.push(
      makeSpotPosition({
        position_id: encodePath('HTX', 'SWAP-ASSET', v.margin_asset),
        datasource_id: 'HTX',
        product_id: encodePath('HTX', 'SWAP-ASSET', v.margin_asset),
        volume: +v.margin_static,
        free_volume: +v.withdraw_available,
        closable_price: usdAssets.has(v.margin_asset) ? 1 : 0,
      }),
    );
  }

  // positions
  const positionsRes = await getSwapCrossPositionInfo(credential);
  for (const v of positionsRes.data || []) {
    const product_id = encodePath('HTX', 'SWAP', v.contract_code);
    const theProduct = await productCache.query(product_id);
    const valuation = v.volume * v.last_price * (theProduct?.value_scale || 1);
    positions.push({
      position_id: `${product_id}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
      datasource_id: 'HTX',
      product_id,
      direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
      volume: v.volume,
      free_volume: v.available,
      position_price: v.cost_hold,
      closable_price: v.last_price,
      floating_profit: v.profit_unreal,
      liquidation_price: v.liquidation_price ? `${v.liquidation_price}` : undefined,
      valuation,
    });
  }

  return positions;
};

export const getUnionAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];
  // balance
  const [balance, position] = await Promise.all([
    getUnionAccountBalance(credential),
    getUnionAccountPositions(credential),
  ]);

  if (!balance.data || !balance.data.details) {
    throw new Error('Failed to get union account balance');
  }
  for (const v of balance.data.details || []) {
    positions.push(
      makeSpotPosition({
        position_id: encodePath('HTX', 'SWAP-ASSET', v.currency),
        datasource_id: 'HTX',
        product_id: encodePath('HTX', 'SWAP-ASSET', v.currency),
        volume: +v.available,
        free_volume: +v.withdraw_available,
        closable_price: usdAssets.has(v.currency) ? 1 : 0,
        size: v.available,
      }),
    );
  }
  if (!position || !position.data) {
    throw new Error('Failed to get union account positions');
  }
  for (const v of position.data || []) {
    const product_id = encodePath('HTX', 'SWAP', v.contract_code);
    const theProduct = await productCache.query(product_id);
    const valuation = +v.volume * +v.mark_price * (theProduct?.value_scale || 1);
    positions.push({
      position_id: `${product_id}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
      datasource_id: 'HTX',
      product_id,
      direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
      volume: +v.volume,
      free_volume: +v.available,
      position_price: +v.open_avg_price,
      closable_price: +v.mark_price,
      floating_profit: +v.profit_unreal,
      liquidation_price: v.liquidation_price ? `${v.liquidation_price}` : undefined,
      valuation,
    });
  }

  return positions;
};
