import { SMA } from './SMA';
import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates Bollinger Bands for a time series.
 * @public
 */
export const BB = (source: ITimeSeries<number>, length: number = 20, stdDev: number = 2) => {
  const middleBand = SMA(source, length);

  const variance = combine<number>(
    { id: `variance(${source.tags.id},${length})` },
    (index) => {
      let sum = 0;
      let cnt = 0;
      for (let j = Math.max(0, index - length + 1); j <= index; j++) {
        const diff = source[j] - middleBand[index];
        sum += diff * diff;
        cnt++;
      }
      return sum / cnt;
    },
    [source, middleBand],
  );

  const stdDevSeries = combine<number>(
    { id: `stdDev(${source.tags.id},${length})` },
    (index) => Math.sqrt(variance[index]),
    [variance],
  );

  const upperBand = combine<number>(
    { id: `BB_Upper(${source.tags.id},${length},${stdDev})` },
    (index) => middleBand[index] + stdDev * stdDevSeries[index],
    [middleBand, stdDevSeries],
  );

  const lowerBand = combine<number>(
    { id: `BB_Lower(${source.tags.id},${length},${stdDev})` },
    (index) => middleBand[index] - stdDev * stdDevSeries[index],
    [middleBand, stdDevSeries],
  );

  return {
    middleBand,
    upperBand,
    lowerBand,
  };
};
