/**
 * 计算 Rolling TopK
 * @param series - 非0序列会被采样
 * @param k - 第 k 大
 * @param period - 滑动窗口周期
 */
export const useTopK = (series: Series, k: number, period: number) => {
  const indexes = useRef<number[]>([]);
  const ret = useSeries(`TOP_K(${series.name},${k},${period})`, series, {});
  const i = series.length - 1;
  useEffect(() => {
    if (i < 0) return;
    let isChanged = false;
    // remove expired indexes
    if (indexes.current[0] <= i - period) {
      indexes.current.shift();
      isChanged = true;
    }
    if (series[i - 1]) {
      indexes.current.push(i - 1);
      isChanged = true;
    }

    if (isChanged) {
      const sorted = [...indexes.current].sort((a, b) => series[b] - series[a]);
      ret[i] = series[sorted[Math.min(k, sorted.length) - 1]];
    } else {
      ret[i] = ret[i - 1] ?? NaN;
    }
  }, [i]);
  return ret;
};
