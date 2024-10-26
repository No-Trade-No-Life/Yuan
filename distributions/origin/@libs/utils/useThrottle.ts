/**
 * 节流信号，源信号在发出非零信号后一定时间内会被静默为 NaN
 * @param series - 源信号
 * @param period - 静默周期
 */
export const useThrottle = (series: Series, period: number) => {
  const ret = useSeries(`THROTTLE(${series.name},${period})`, series, {});
  const openIdxRef = useRef(0);
  useEffect(() => {
    const i = series.length - 1;
    if (i < 0) return;
    if (i < openIdxRef.current) {
      ret[i] = NaN;
      return;
    }
    if (series[i - 1]) {
      openIdxRef.current = i + period;
      ret[i - 1] = series[i - 1];
      ret[i] = NaN;
      return;
    }
    ret[i] = series[i];
  });
  return ret;
};
