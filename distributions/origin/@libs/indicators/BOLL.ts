import { useSMA, useSTD, useSeriesMap } from '@libs';

/**
 * 计算 BOLL 指标
 * @param source - 源数据序列
 * @param period - 周期
 * @param multiplier - 标准差倍数
 */
export const useBOLL = (source: Series, period: number = 20, multiplier: number = 2) => {
  const MIDDLE = useSMA(source, period);
  useEffect(() => {
    MIDDLE.name = `BOLL.MIDDLE(${source.name}, ${period}, ${multiplier})`;
  }, []);
  const STD = useSTD(source, period);
  useEffect(() => {
    STD.tags.display = 'none';
  }, []);
  const UPPER = useSeriesMap(
    `BOLL.UPPER(${source.name}, ${period}, ${multiplier})`,
    source,
    { display: 'line' },
    (i) => MIDDLE[i] + multiplier * STD[i],
  );
  const LOWER = useSeriesMap(
    `BOLL.LOWER(${source.name}, ${period}, ${multiplier})`,
    source,
    { display: 'line' },
    (i) => MIDDLE[i] - multiplier * STD[i],
  );
  return { MIDDLE, UPPER, LOWER };
};
