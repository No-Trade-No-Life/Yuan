import { IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { firstValueFrom } from 'rxjs';
import { getSwapCrossPositionInfo, getUnifiedAccountInfo, ICredential } from '../../api/private-api';
import { productService } from '../product';

export const getSwapAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  // balance
  const balance = await getUnifiedAccountInfo(credential);
  if (!balance.data) {
    throw new Error('Failed to get unified account info');
  }
  const balanceData = balance.data.find((v) => v.margin_asset === 'USDT');
  if (!balanceData) {
    throw new Error('No USDT balance found in unified account');
  }

  // positions
  const positionsRes = await getSwapCrossPositionInfo(credential);
  const mapProductIdToPerpetualProduct = await firstValueFrom(productService.mapProductIdToProduct$);
  const positions: IPosition[] = (positionsRes.data || []).map((v): IPosition => {
    const product_id = encodePath('HTX', 'SWAP', v.contract_code);
    const theProduct = mapProductIdToPerpetualProduct?.get(product_id);
    const valuation = v.volume * v.last_price * (theProduct?.value_scale || 1);
    return {
      position_id: `${product_id}/${v.contract_type}/${v.direction}/${v.margin_mode}`,
      datasource_id: 'HTX',
      product_id,
      direction: v.direction === 'buy' ? 'LONG' : 'SHORT',
      volume: v.volume,
      free_volume: v.available,
      position_price: v.cost_hold,
      closable_price: v.last_price,
      floating_profit: v.profit_unreal,
      valuation,
    };
  });

  return positions;
};
