import { useSeriesMap } from '@libs/utils';
import { useRollingMinIndex } from './useIdxOfMin';

/**
 * 计算滑动窗口最小值 (Rolling Min)
 *
 * 利用了单调队列，均摊时间复杂度为 O(n)
 *
 * @param source 输入数据源
 * @param period 周期 (>0)
 */
export const useMIN = (source: Series, period: number) => {
  const iMIN = useRollingMinIndex(source, period);
  const MIN = useSeriesMap(
    `MIN(${source.name},${period})`,
    iMIN,
    {
      display: 'line',
    },
    (i) => source[iMIN[i]],
  );
  return MIN;
};
