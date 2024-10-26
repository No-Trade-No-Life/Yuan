/**
 * 使用带有填充函数的序列，基本等同于 `useSeries`，但是可以使用填充函数来填充序列
 * @param fn - 填充函数
 */
export const useSeriesMap = (
  name: string,
  parent: Series,
  tags: Record<string, any> | undefined,
  fn: (i: number, series: Series) => number,
) => {
  const series = useSeries(name, parent, tags);
  useEffect(() => {
    const i = parent.length - 1;
    if (i < 0) return;
    series[i] = fn(i, series);
  });
  return series;
};
