import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Normalizes a time series using Robust scaling over a rolling window.
 * This transforms the data using median and interquartile range (IQR) to be robust to outliers.
 * @param source - input time series
 * @param windowSize - size of the rolling window
 * @returns normalized time series with median 0 and IQR-based scaling
 * @public
 */
export const robust_scale = (source: ITimeSeries<number>, windowSize: number) =>
  combine(
    { id: `${source.tags.id}_robust` },
    (i) => {
      if (i < windowSize) return NaN;

      const windowStart = Math.max(0, i - windowSize);
      const windowEnd = i;
      const windowLength = windowEnd - windowStart + 1;

      // Extract window data
      const windowData: number[] = [];
      for (let j = windowStart; j <= windowEnd; j++) {
        windowData.push(source[j]);
      }

      // Sort the data for percentile calculations
      const sortedData = [...windowData].sort((a, b) => a - b);

      // Calculate median (50th percentile)
      const median = sortedData[Math.floor(windowLength / 2)];

      // Calculate Q1 (25th percentile) and Q3 (75th percentile)
      const q1Index = Math.floor(windowLength * 0.25);
      const q3Index = Math.floor(windowLength * 0.75);
      const q1 = sortedData[q1Index];
      const q3 = sortedData[q3Index];

      // Calculate IQR (Interquartile Range)
      const iqr = q3 - q1;

      // Avoid division by zero
      if (iqr === 0) return 0;

      return (source[i] - median) / iqr;
    },
    [source],
  );
