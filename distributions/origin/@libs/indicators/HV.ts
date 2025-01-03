import { useSTD, useSeriesMap } from '@libs';
/**
 * 计算历史波动率指标
 * @param source
 * @param period
 * @returns
 */
export const useHV = (source: Series, period: number): Series => {
  const logROI = useSeriesMap(`LOGROI(${source.name}, ${period})`, source, {}, (i) =>
    i > 0 ? Math.log(source[i]) - Math.log(source[i - 1]) : 0,
  );

  const std = useSTD(logROI, period);
  useEffect(() => {
    std.tags.display = 'none';
  }, []);

  const HV = useSeriesMap(
    `HV(${source.name}, ${period})`,
    source,
    {
      display: 'line',
      chart: 'new',
    },
    (i) => std[i] * Math.sqrt(period),
  );

  return HV;
};
