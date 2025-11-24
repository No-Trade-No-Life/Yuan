import { IPosition } from './interface';

/**
 * Simple factory to create a spot position
 * @param position - Partial position information
 * @returns Complete spot position
 * @public
 */
export const makeSpotPosition = (
  position: Omit<IPosition, 'position_price' | 'direction' | 'valuation' | 'floating_profit'>,
): IPosition => {
  // For spot positions, we set position_price to 0
  const position_price = 0;
  const closable_price = position.closable_price;
  const volume = position.volume;
  const valuation = volume * closable_price;
  const direction = 'LONG';
  const floating_profit = valuation;
  return { ...position, position_price, closable_price, direction, valuation, floating_profit };
};
