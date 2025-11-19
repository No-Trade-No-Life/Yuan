import { EMA } from './EMA';
import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Moving Average Convergence Divergence (MACD) indicator.
 * @public
 */
export const MACD = (
  source: ITimeSeries<number>,
  fastLength: number = 12,
  slowLength: number = 26,
  signalLength: number = 9,
) => {
  const fastEMA = EMA(source, fastLength);
  const slowEMA = EMA(source, slowLength);

  const macdLine = combine<number>(
    { id: `MACD(${source.tags.id},${fastLength},${slowLength})` },
    (index) => fastEMA[index] - slowEMA[index],
    [fastEMA, slowEMA],
  );

  const signalLine = EMA(macdLine, signalLength);
  signalLine.tags.id = `MACD_Signal(${source.tags.id},${signalLength})`;

  const histogram = combine<number>(
    { id: `MACD_Histogram(${source.tags.id})` },
    (index) => macdLine[index] - signalLine[index],
    [macdLine, signalLine],
  );

  return {
    macdLine,
    signalLine,
    histogram,
  };
};
