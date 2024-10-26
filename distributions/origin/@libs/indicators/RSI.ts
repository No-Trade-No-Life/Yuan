import { useEMA, useSeriesMap } from '@libs';

/**
 * 计算相对强弱指标 (RSI)
 * @param source - 源数据
 * @param period - 周期
 */
export const useRSI = (source: Series, period = 14) => {
  const U = useSeriesMap('U', source, {}, (i) => (source[i] > source[i - 1] ? source[i] - source[i - 1] : 0));
  const D = useSeriesMap('D', source, {}, (i) => (source[i] < source[i - 1] ? source[i - 1] - source[i] : 0));
  const EMA_U = useEMA(U, period);
  const EMA_D = useEMA(D, period);
  useEffect(() => {
    EMA_U.tags.display = 'none';
    EMA_D.tags.display = 'none';
  }, []);
  const RSI = useSeriesMap(
    `RSI(${source.name},${period})`,
    source,
    {
      display: 'line',
      chart: 'new',
    },
    (i) => (EMA_U[i] / (EMA_U[i] + EMA_D[i])) * 100,
  );
  return RSI;
};
