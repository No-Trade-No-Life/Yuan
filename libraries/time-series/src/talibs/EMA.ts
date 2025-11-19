import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Exponential Moving Average (EMA) of a time series.
 * @public
 */
export const EMA = (source: ITimeSeries<number>, length: number) => {
  const alpha = 2 / (length + 1);
  return combine<number>(
    { id: `EMA(${source.tags.id},${length})` },
    (index, dst) => {
      if (index === 0) {
        return source[index];
      } else {
        return alpha * source[index] + (1 - alpha) * dst[index - 1];
      }
    },
    [source],
  );
};
