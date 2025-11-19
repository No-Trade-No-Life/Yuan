import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Simple Moving Average (SMA) of a time series.
 * @public
 */
export const SMA = (source: ITimeSeries<number>, length: number) =>
  combine(
    { id: `SMA(${source.tags.id},${length})` },
    (index) => {
      let sum = 0;
      let cnt = 0;
      for (let j = Math.max(0, index - length + 1); j <= index; j++) {
        sum += source[j];
        cnt++;
      }
      return sum / cnt;
    },
    [source],
  );
