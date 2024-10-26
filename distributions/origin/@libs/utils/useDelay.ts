import { useSeriesMap } from './useSeriesMap';

/**
 * 将信号延迟 N 个周期
 * @param series - 信号
 * @param period - 周期
 */
export const useDelay = (series: Series, period: number) =>
  useSeriesMap(`DELAY(${series.name}, ${period})`, series, {}, (i) => series[i - period] ?? NaN);
