import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Normalizes a time series using Standard (Z-score) scaling over a rolling window.
 * This transforms the data to have zero mean and unit variance.
 * @param source - input time series
 * @param windowSize - size of the rolling window
 * @returns normalized time series with mean 0 and standard deviation 1
 * @public
 */
export const standard_scale = (source: ITimeSeries<number>, windowSize: number) =>
  combine(
    { id: `${source.tags.id}_standard` },
    (i) => {
      if (i < windowSize) return NaN;

      // Calculate mean
      let sum = 0;
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        sum += source[j];
      }
      const mean = sum / (windowSize + 1);

      // Calculate standard deviation
      let variance = 0;
      for (let j = Math.max(0, i - windowSize); j <= i; j++) {
        variance += Math.pow(source[j] - mean, 2);
      }
      const std = Math.sqrt(variance / (windowSize + 1));

      // Avoid division by zero
      if (std === 0) return 0;

      return (source[i] - mean) / std;
    },
    [source],
  );
