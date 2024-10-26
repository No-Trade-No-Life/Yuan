/**
 * Merge Positions by product_id/variant
 * @param positions - List of Positions
 * @returns - Merged Positions
 *
 * @public
 */
export const mergePositions = (positions: IPosition[]): IPosition[] => {
  const mapProductIdToPosition = positions.reduce((acc, cur) => {
    const { product_id, direction } = cur;
    if (!acc[`${product_id}-${direction}`]) {
      acc[`${product_id}-${direction}`] = { ...cur };
    } else {
      let thePosition = acc[`${product_id}-${direction}`];
      thePosition = {
        ...thePosition,
        volume: thePosition.volume + cur.volume,
        free_volume: thePosition.free_volume + cur.free_volume,
        position_price:
          (thePosition.position_price * thePosition.volume + cur.position_price * cur.volume) /
          (thePosition.volume + cur.volume),
        floating_profit: thePosition.floating_profit + cur.floating_profit,
        closable_price:
          (thePosition.closable_price * thePosition.volume + cur.closable_price * cur.volume) /
          (thePosition.volume + cur.volume),
      };
      acc[`${product_id}-${direction}`] = thePosition;
    }
    return acc;
  }, {} as Record<string, IPosition>);
  return Object.values(mapProductIdToPosition);
};
