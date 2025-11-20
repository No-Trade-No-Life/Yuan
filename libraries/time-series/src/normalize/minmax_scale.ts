import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Normalizes a time series using Min-Max scaling over a rolling window.
 * @param source - input time series
 * @param windowSize - size of the rolling window
 * @returns normalized time series from 0 to 1
 * @public
 */
export const minmax_scale = (source: ITimeSeries<number>, windowSize: number) =>
  combine(
    { id: `${source.tags.id}_minmax` },
    (i) => {
      if (i < windowSize) return NaN;
      let min = Infinity;
      let max = -Infinity;
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        if (source[j] < min) min = source[j];
        if (source[j] > max) max = source[j];
      }
      return (source[i] - min) / (max - min);
    },
    [source],
  );
