import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { encodePath, formatTime } from '@yuants/utils';
import { getUserPerpetualsAccountSummary } from '../../api/public-api';
import { ICredential } from '../../api/types';

/**
 * Get account info for perpetual account
 */
export const getPerpPositions = async (credential: ICredential) => {
  console.info(formatTime(Date.now()), `Getting perp account info for ${credential.address}`);

  const summary = await getUserPerpetualsAccountSummary({ user: credential.address });

  const perpPositions = summary.assetPositions.map(
    (position): IPosition => ({
      position_id: `${position.position.coin}-USD`,
      datasource_id: 'HYPERLIQUID',
      product_id: encodePath('HYPERLIQUID', 'PERPETUAL', `${position.position.coin}-USD`),
      direction: +position.position.szi > 0 ? 'LONG' : 'SHORT',
      volume: Math.abs(+position.position.szi),
      free_volume: Math.abs(+position.position.szi),
      position_price: +position.position.entryPx,
      closable_price: Math.abs(+position.position.positionValue / +position.position.szi || 0),
      floating_profit: +position.position.unrealizedPnl,
      valuation: +position.position.positionValue,
      liquidation_price: position.position.liquidationPx,
      margin: +position.position.marginUsed,
    }),
  );

  const totalUnrealizedPnl = summary.assetPositions.reduce(
    (acc, assetPosition) => acc + Number(assetPosition.position.unrealizedPnl || 0),
    0,
  );
  const accountValue = Number(summary.marginSummary?.accountValue ?? 0);
  const usdcBalance = accountValue - totalUnrealizedPnl;
  const usdcPositions =
    usdcBalance > 0
      ? [
          makeSpotPosition({
            position_id: 'USDC',
            datasource_id: 'HYPERLIQUID',
            product_id: encodePath('HYPERLIQUID', 'PERPETUAL-ASSET', 'USDC'),
            volume: usdcBalance,
            free_volume: usdcBalance,
            closable_price: 1,
          }),
        ]
      : [];

  return [...usdcPositions, ...perpPositions];
};
