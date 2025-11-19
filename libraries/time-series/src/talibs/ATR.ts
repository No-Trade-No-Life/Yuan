import { combine } from '../combine';
import { ITimeSeries } from '../interfaces';

/**
 * Calculates the Average True Range (ATR) for price data.
 * @public
 */
export const ATR = (
  high: ITimeSeries<number>,
  low: ITimeSeries<number>,
  close: ITimeSeries<number>,
  length: number = 14,
) => {
  const trueRange = combine<number>(
    { id: `TR(${high.tags.id},${low.tags.id},${close.tags.id})` },
    (index) => {
      const prevClose = close[index - 1] ?? close[index];
      const tr1 = high[index] - low[index];
      const tr2 = Math.abs(high[index] - prevClose);
      const tr3 = Math.abs(low[index] - prevClose);
      return Math.max(tr1, tr2, tr3);
    },
    [high, low, close],
  );

  return combine<number>(
    { id: `ATR(${high.tags.id},${low.tags.id},${close.tags.id},${length})` },
    (index) => {
      if (index < length) return trueRange[index];

      let sum = 0;
      for (let i = index - length + 1; i <= index; i++) {
        sum += trueRange[i];
      }
      return sum / length;
    },
    [trueRange],
  );
};
