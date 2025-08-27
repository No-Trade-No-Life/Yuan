import { useSeriesMap } from '@libs/utils';
import { useRollingMaxIndex } from './useIdxOfMax';

/**
 * 计算滑动窗口最大值 (Rolling Max)
 *
 * 利用了单调队列，均摊时间复杂度为 O(n)
 *
 * @param source 输入数据源
 * @param period 周期 (>0)
 */
export const useMAX = (source: Series, period: number) => {
  const iMAX = useRollingMaxIndex(source, period);
  const MAX = useSeriesMap(
    `MAX(${source.name},${period})`,
    iMAX,
    {
      display: 'line',
    },
    (i) => source[iMAX[i]],
  );
  return MAX;
};
