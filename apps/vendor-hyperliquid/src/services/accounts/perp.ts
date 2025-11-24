import { IPosition } from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { getUserPerpetualsAccountSummary } from '../../api/public-api';
import { getAddressFromCredential, ICredential } from '../../api/types';

/**
 * Get account info for perpetual account
 */
export const getPerpAccountInfo = async (credential: ICredential, account_id: string) => {
  console.info(`[${formatTime(Date.now())}] Getting perp account info for ${account_id}`);

  const summary = await getUserPerpetualsAccountSummary({ user: getAddressFromCredential(credential) });

  // Map positions
  const positions = summary.assetPositions.map(
    (position): IPosition => ({
      position_id: `${position.position.coin}-USD`,
      datasource_id: 'HYPERLIQUID',
      product_id: encodePath('PERPETUAL', `${position.position.coin}-USD`),
      direction: +position.position.szi > 0 ? 'LONG' : 'SHORT',
      volume: Math.abs(+position.position.szi),
      free_volume: Math.abs(+position.position.szi),
      position_price: +position.position.entryPx,
      closable_price: Math.abs(+position.position.positionValue / +position.position.szi || 0),
      floating_profit: +position.position.unrealizedPnl,
      valuation: +position.position.positionValue,
      margin: +position.position.marginUsed,
    }),
  );

  // Map orders
  const mapOrderDirection = (side: string) => {
    const normalized = side.toUpperCase();
    if (normalized === 'BID' || normalized === 'BUY') {
      return 'OPEN_LONG';
    }
    if (normalized === 'ASK' || normalized === 'SELL') {
      return 'OPEN_SHORT';
    }
    return 'OPEN_LONG';
  };

  return positions;
};
