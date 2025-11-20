import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Quantile Transform normalization function
 * @param source - input time series
 * @param windowSize - size of the rolling window
 * @returns normalized time series from 0 to 1
 * @public
 */
export const quantile_transform = (source: ITimeSeries<number>, windowSize: number) =>
  combine(
    { id: `${source.tags.id}_quantile` },
    (i) => {
      const windowStartIndex = Math.max(0, i - windowSize);
      const windowDataCount = i - windowStartIndex; // Exclude current index
      let rank = 0;
      for (let j = windowStartIndex; j < i; j++) {
        if (source[i] > source[j]) {
          rank++;
        }
      }
      return rank / windowDataCount;
    },
    [source],
  );
