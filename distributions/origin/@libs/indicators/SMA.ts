import { useSUM, useSeriesMap } from '@libs';
/**
 * 使用移动平均线指标
 * @param source
 * @param period
 * @returns
 */
export const useSMA = (source: Series, period: number): Series => {
  const SUM = useSUM(source, period);
  const SMA = useSeriesMap(
    `SMA(${source.name},${period})`,
    source,
    {
      display: 'line',
    },
    (i) => SUM[i] / Math.min(i + 1, period),
  );
  return SMA;
};
