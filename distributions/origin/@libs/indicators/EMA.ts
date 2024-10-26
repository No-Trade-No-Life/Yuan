import { useSeriesMap } from '@libs';

/**
 * 计算指数移动平均线 (EMA)
 * @param source - 源数据
 * @param period - 周期
 * @returns 指数移动平均线序列
 */
export const useEMA = (source: Series, period: number) =>
  useSeriesMap(
    `EMA(${source.name}, ${period})`,
    source,
    {
      display: 'line',
    },
    (i, EMA) => (i > 0 ? (2 * source[i] + (period - 1) * EMA[i - 1]) / (period + 1) : source[i]),
  );
