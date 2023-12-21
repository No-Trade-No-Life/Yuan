import { useAgent, useEffect, useMemo, useSeries } from '.';

const mapDurationToPeriodInSec = (duration: string) => {
  const match = duration.match(
    /^P(?:((?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?)(?:T((?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?))?|((\d+)W))$/,
  );
  const [durDate, year, month, day, durTime, hour, minute, second, durWeek, week] = match?.slice(1) ?? [];
  if (durDate || durTime || durWeek) {
    return (
      (+year || 0) * 365 * 24 * 60 * 60 +
      (+month || 0) * 30 * 24 * 60 * 60 +
      (+day || 0) * 24 * 60 * 60 +
      (+hour || 0) * 60 * 60 +
      (+minute || 0) * 60 +
      (+second || 0) +
      (+week || 0) * 7 * 24 * 60 * 60
    );
  }
  return NaN;
};
/**
 * 使用 OHLC(V) 数据
 * @param datasource_id - 数据源ID
 * @param product_id - 品种ID
 * @param period - 周期(秒) 或 周期字符串 (RFC-3339 Duration)
 * @returns
 * @public
 */
export const useOHLC = (datasource_id: string, product_id: string, period: number | string) => {
  const agent = useAgent();
  const periodInSec = useMemo(
    () => (typeof period === 'string' ? mapDurationToPeriodInSec(period) : period),
    [period],
  );
  const key = [datasource_id, product_id, periodInSec].join(); // TODO: Memoize Key

  const time = useSeries(`T(${key})`, undefined, {
    type: 'period',
    subType: 'timestamp_in_us',
    datasource_id,
    product_id,
    period_in_sec: periodInSec,
  });
  const open = useSeries(`O(${key})`, time);
  const high = useSeries(`H(${key})`, time);
  const low = useSeries(`L(${key})`, time);
  const close = useSeries(`C(${key})`, time);
  const volume = useSeries(`VOL(${key})`, time);

  useEffect(() => {
    agent.productLoadingUnit?.productTasks.push({
      datasource_id,
      product_id,
    });
    agent.dataLoadingTaskUnit?.periodTasks.push({
      datasource_id,
      product_id,
      period_in_sec: periodInSec,
      start_time_in_us: agent.options.start_time * 1000,
      end_time_in_us: agent.options.end_time * 1000,
    });
  }, []);

  const periods = agent.periodDataUnit.data[key] ?? [];
  const idx = periods.length - 1;

  useEffect(() => {
    const period = periods[idx];
    if (period) {
      time[idx] = period.timestamp_in_us / 1000;
      open[idx] = period.open;
      high[idx] = period.high;
      low[idx] = period.low;
      close[idx] = period.close;
      volume[idx] = period.volume;
    }
  });

  return { time, open, high, low, close, volume };
};
