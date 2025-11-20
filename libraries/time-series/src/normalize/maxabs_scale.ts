import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Normalizes a time series using MaxAbs scaling over a rolling window.
 * This scales the data by the maximum absolute value in the window, preserving sparsity.
 * @param source - input time series
 * @param windowSize - size of the rolling window
 * @returns normalized time series scaled by maximum absolute value
 * @public
 */
export const maxabs_scale = (source: ITimeSeries<number>, windowSize: number) =>
  combine(
    { id: `${source.tags.id}_maxabs` },
    (i) => {
      if (i < windowSize) return NaN;

      // Find maximum absolute value in the window
      let maxAbs = 0;
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        const absValue = Math.abs(source[j]);
        if (absValue > maxAbs) maxAbs = absValue;
      }

      // Avoid division by zero
      if (maxAbs === 0) return 0;

      return source[i] / maxAbs;
    },
    [source],
  );
