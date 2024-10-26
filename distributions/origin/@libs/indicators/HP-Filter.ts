import { useSeriesMap } from '@libs';

/**
 * 使用 Hodrick-Prescott 滤波器，返回低频趋势性信号
 *
 * @param source 输入数据源
 * @param lambda 平滑系数
 */
export const useHPFilter = (source: Series, lambda: number) =>
  useSeriesMap(
    `HP(${source.name},${lambda})`,
    source,
    {
      display: 'line',
      chart: 'new',
    },
    (i, HP) =>
      source.length <= 2
        ? source[i]
        : (4 * lambda * HP[i - 1] + 2 * source[i] - 2 * lambda * HP[i - 2]) / (2 + 2 * lambda),
  );
