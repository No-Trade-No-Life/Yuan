import { useSeriesMap } from '@libs';

/**
 * 使用移动求积计算指标
 * @param source
 * @param period
 * @returns
 */
export const usePROD = (source: Series, period: number) =>
  useSeriesMap(
    `PROD(${source.name}, ${period})`,
    source,
    {},
    (i, PROD) => (source[i] * (i > 0 ? PROD[i - 1] : 1)) / (i - period >= 0 ? source[i - period] : 1),
  );
