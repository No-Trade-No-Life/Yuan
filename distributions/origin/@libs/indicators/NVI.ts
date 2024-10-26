import { useEMA, useSeriesMap } from '@libs';

export const useNVI = (volume: Series, close: Series, period: number = 72) => {
  const NVI = useSeriesMap(`NVI`, close, { display: 'line', chart: 'new' }, (i, s) =>
    i === 0
      ? 100
      : s[i - 1] *
        (volume[i] < volume[i - 1]
          ? Math.abs(
              // abs 是对负数价格的特殊处理
              close[i] / close[i - 1],
            )
          : 1),
  );
  const MA_NVI = useEMA(NVI, period);
  useEffect(() => {
    MA_NVI.name = 'MA_NVI';
  }, []);
  return { NVI: NVI, MA_NVI: MA_NVI };
};
