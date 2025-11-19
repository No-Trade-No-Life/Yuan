import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Stochastic Oscillator.
 * @public
 */
export const Stochastic = (
  high: ITimeSeries<number>,
  low: ITimeSeries<number>,
  close: ITimeSeries<number>,
  kPeriod: number = 14,
  dPeriod: number = 3,
) => {
  const highestHigh = combine<number>(
    { id: `HH(${high.tags.id},${kPeriod})` },
    (index) => {
      let max = -Infinity;
      for (let i = Math.max(0, index - kPeriod + 1); i <= index; i++) {
        if (high[i] > max) max = high[i];
      }
      return max;
    },
    [high],
  );

  const lowestLow = combine<number>(
    { id: `LL(${low.tags.id},${kPeriod})` },
    (index) => {
      let min = Infinity;
      for (let i = Math.max(0, index - kPeriod + 1); i <= index; i++) {
        if (low[i] < min) min = low[i];
      }
      return min;
    },
    [low],
  );

  const kLine = combine<number>(
    { id: `%K(${close.tags.id},${kPeriod})` },
    (index) => {
      const hh = highestHigh[index];
      const ll = lowestLow[index];
      if (hh === ll) return 50;
      return ((close[index] - ll) / (hh - ll)) * 100;
    },
    [close, highestHigh, lowestLow],
  );

  const dLine = combine<number>(
    { id: `%D(${close.tags.id},${dPeriod})` },
    (index) => {
      if (index < dPeriod) return kLine[index];
      let sum = 0;
      for (let i = index - dPeriod + 1; i <= index; i++) {
        sum += kLine[i];
      }
      return sum / dPeriod;
    },
    [kLine],
  );

  return {
    kLine,
    dLine,
  };
};
