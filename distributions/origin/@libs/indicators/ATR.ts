import { useSMA, useSeriesMap } from '@libs';

/**
 * 计算真实波动范围 (ATR)
 * @param H - 最高价
 * @param L - 最低价
 * @param C - 收盘价
 * @param period - 周期 (默认 14)
 * @returns ATR 序列
 */
export const useATR = (H: Series, L: Series, C: Series, period: number = 14) => {
  const TR = useSeriesMap('TR', C, {}, (i) =>
    Math.max(
      //
      Math.abs(H[i] - L[i]),
      i > 0 ? Math.abs(H[i] - C[i - 1]) : -Infinity,
      i > 0 ? Math.abs(L[i] - C[i - 1]) : -Infinity,
    ),
  );
  const ATR = useSMA(TR, period);
  useEffect(() => {
    ATR.name = `ATR(${period})`;
    ATR.tags.display = 'line';
    ATR.tags.chart = 'new';
  }, []);
  return { ATR, TR };
};
