import { IPosition } from '@yuants/data-account';
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
    .filter((balance: any) => Number(balance.total) > 0)
    .map(
      (balance: any): IPosition => ({
        position_id: `${balance.coin}`,
        datasource_id: 'HYPERLIQUID',
        product_id: encodePath('SPOT', `${balance.coin}-USDC`),
        direction: 'LONG',
        volume: Number(balance.total),
        free_volume: Number(balance.total) - Number(balance.hold),
        position_price: 1, // USDC as quote currency
        closable_price: 1,
        floating_profit: 0,
        valuation: Number(balance.total),
        margin: 0,
      }),
    );

  return {
    money: {
      currency: 'USDC',
      equity: positions.reduce((sum: number, pos: any) => sum + pos.valuation, 0),
      free: positions.reduce((sum: number, pos: any) => sum + pos.free_volume, 0),
    },
    positions,
    pending_orders: [], // Spot orders would need separate API call
  };
};
