import { IPosition, IPositionDiff } from './interface';

/**
 * Calculate position differences, automatically merging positions with the same product_id/direction
 * @public
 * @param source - Source position list
 * @param target - Target position list
 * @returns - Position difference list
 */
export const diffPosition = (source: IPosition[], target: IPosition[]) => {
  const positionDiffMap = new Map<string, IPositionDiff>();

  for (const position of source) {
    const key = `${position.product_id}-${position.direction}`;

    if (positionDiffMap.has(key)) {
      const existingDiff = positionDiffMap.get(key)!;
      existingDiff.volume_in_source += position.volume;
    } else {
      positionDiffMap.set(key, {
        product_id: position.product_id,
        direction: position.direction!,
        volume_in_source: position.volume,
        volume_in_target: 0,
        error_volume: 0,
      });
    }
  }

  for (const position of target) {
    const key = `${position.product_id}-${position.direction}`;

    if (positionDiffMap.has(key)) {
      const existingDiff = positionDiffMap.get(key)!;
      existingDiff.volume_in_target += position.volume;
    } else {
      positionDiffMap.set(key, {
        product_id: position.product_id,
        direction: position.direction!,
        volume_in_source: 0,
        volume_in_target: position.volume,
        error_volume: 0,
      });
    }
  }

  const result: IPositionDiff[] = [];
  for (const diff of positionDiffMap.values()) {
    diff.error_volume = diff.volume_in_source - diff.volume_in_target;
    result.push(diff);
  }

  return result;
};
