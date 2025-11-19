import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Relative Strength Index (RSI) of a time series.
 * @public
 */
export const RSI = (source: ITimeSeries<number>, length: number) => {
  const gains = combine<number>(
    { id: `gains(${source.tags.id})` },
    (index) => Math.max(0, source[index] - (source[index - 1] ?? source[index])),
    [source],
  );

  const losses = combine<number>(
    { id: `losses(${source.tags.id})` },
    (index) => Math.max(0, (source[index - 1] ?? source[index]) - source[index]),
    [source],
  );

  return combine<number>(
    { id: `RSI(${source.tags.id},${length})` },
    (index) => {
      if (index < length) return 50;

      let avgGain = 0;
      let avgLoss = 0;

      for (let i = index - length + 1; i <= index; i++) {
        avgGain += gains[i];
        avgLoss += losses[i];
      }

      avgGain /= length;
      avgLoss /= length;

      if (avgLoss === 0) return 100;
      const rs = avgGain / avgLoss;
      return 100 - 100 / (1 + rs);
    },
    [gains, losses],
  );
};
