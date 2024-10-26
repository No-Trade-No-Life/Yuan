import { useSMA, useSTD, useSeriesMap } from '@libs';

/**
 * Commodity Channel Index
 * @param high - 最高价
 * @param low - 最低价
 * @param close - 收盘价
 * @param period - 周期，默认 20
 */
export const useCCI = (high: Series, low: Series, close: Series, period: number = 20) => {
  const tp = useSeriesMap(`TP`, close, {}, (i) => (high[i] + low[i] + close[i]) / 3);
  const ma = useSMA(tp, period);
  const dev = useSTD(tp, period);
  useEffect(() => {
    ma.tags.display = 'none';
    dev.tags.display = 'none';
  }, []);
  const CCI = useSeriesMap(
    `CCI(${period})`,
    close,
    { display: 'line', chart: 'new' },
    (i) => (tp[i] - ma[i]) / (0.015 * dev[i]),
  );
  return CCI;
};
