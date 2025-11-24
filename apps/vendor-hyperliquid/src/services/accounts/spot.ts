import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { getUserTokenBalances } from '../../api/public-api';
import { getAddressFromCredential, ICredential } from '../../api/types';

/**
 * Get account info for spot account
 */
export const getSpotAccountInfo = async (credential: ICredential, account_id: string) => {
  console.info(`[${formatTime(Date.now())}] Getting spot account info for ${account_id}`);

  const balances = await getUserTokenBalances({ user: getAddressFromCredential(credential) });

  // Map token balances to positions (using spot as "positions")
  const positions = balances.balances
    .filter((balance) => Number(balance.total) > 0)
    .map(
      (balance): IPosition =>
        makeSpotPosition({
          position_id: `${balance.coin}`,
          datasource_id: 'HYPERLIQUID',
          product_id: encodePath('SPOT', `${balance.coin}-USDC`),
          volume: Number(balance.total),
          free_volume: Number(balance.total) - Number(balance.hold),
          closable_price: 1,
        }),
    );

  return positions;
};
