import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { getAllMids, getUserTokenBalances } from '../../api/public-api';
import { ICredential } from '../../api/types';
import { listProducts } from '../markets/product';

const buildSpotProductMap = async () => {
  const products = await listProducts();
  const map = new Map<string, string>();
  for (const product of products) {
    const [, instType] = product.product_id.split('/');
    if (instType === 'SPOT') {
      map.set(product.base_currency, product.product_id);
    }
  }
  return map;
};

/**
 * Get account info for spot account
 */
export const getSpotPositions = async (credential: ICredential) => {
  console.info(formatTime(Date.now()), `Getting spot account info for ${credential.address}`);

  const [balances, mids, spotProductMap] = await Promise.all([
    getUserTokenBalances({ user: credential.address }),
    getAllMids(),
    buildSpotProductMap(),
  ]);

  // Map token balances to positions (using spot as "positions")
  const positions = balances.balances
    .filter((balance) => Number(balance.total) > 0)
    .map(
      (balance): IPosition =>
        makeSpotPosition({
          position_id: `${balance.coin}`,
          datasource_id: 'HYPERLIQUID',
          product_id:
            spotProductMap.get(balance.coin) ?? encodePath('HYPERLIQUID', 'SPOT', `${balance.coin}-USDC`),
          volume: Number(balance.total),
          free_volume: Number(balance.total) - Number(balance.hold),
          closable_price: balance.coin === 'USDC' ? 1 : Number(mids?.[balance.coin] ?? 0),
        }),
    );

  return positions;
};
