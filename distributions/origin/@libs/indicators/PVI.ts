import { useEMA, useSeriesMap } from '@libs';

export const usePVI = (volume: Series, close: Series, period: number = 72) => {
  const PVI = useSeriesMap(`PVI`, close, { display: 'line', chart: 'new' }, (i, s) =>
    i === 0
      ? 100
      : s[i - 1] *
        (volume[i] > volume[i - 1]
          ? Math.abs(
              // abs 是对负数价格的特殊处理
              close[i] / close[i - 1],
            )
          : 1),
  );
  const MA_PVI = useEMA(PVI, period);
  useEffect(() => {
    MA_PVI.name = 'MA_NPI';
  }, []);
  return { PVI, MA_PVI };
};
