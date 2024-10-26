import { useMAX, useMIN, useSeriesMap } from '@libs';

/**
 * 随机指标 KDJ
 * @param high - 最高价
 * @param low - 最低价
 * @param close - 收盘价
 * @param n - 周期，默认为 9
 */
export const useKDJ = (high: Series, low: Series, close: Series, n: number = 9) => {
  const L = useMIN(low, n);
  const H = useMAX(high, n);
  useEffect(() => {
    L.tags.display = 'none';
    H.tags.display = 'none';
  }, []);
  const RSV = useSeriesMap(`RSV(${n})`, close, {}, (i) => ((close[i] - L[i]) / (H[i] - L[i])) * 100);
  const K = useSeriesMap(
    `KDJ.K(${n})`,
    close,
    {
      display: 'line',
      chart: 'new',
    },
    (i, K) => (2 * (K[i - 1] ?? 50) + RSV[i]) / 3,
  );
  const D = useSeriesMap(
    `KDJ.D(${n})`,
    close,
    { display: 'line', chart: K.series_id },
    (i, D) => (2 * (D[i - 1] ?? 50) + K[i]) / 3,
  );
  const J = useSeriesMap(
    `KDJ.J(${n})`,
    close,
    { display: 'line', chart: K.series_id },
    (i) => 3 * D[i] - 2 * K[i],
  );
  return { K, D, J };
};
