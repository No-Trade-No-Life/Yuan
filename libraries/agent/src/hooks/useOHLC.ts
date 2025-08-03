import { useAgent, useEffect, useSeries } from '.';

/**
 * 使用 OHLC(V) 数据
 * @param datasource_id - 数据源ID
 * @param product_id - 品种ID
 * @param period - 周期(秒) 或 周期字符串 (RFC-3339 Duration)
 * @returns
 * @public
 */
export const useOHLC = (datasource_id: string, product_id: string, duration: string) => {
  const agent = useAgent();
  const key = [datasource_id, product_id, duration].join(); // TODO: Memoize Key

  const time = useSeries(`T(${key})`, undefined, {
    type: 'period',
    subType: 'timestamp_in_us',
    datasource_id,
    product_id,
    duration,
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
      duration,
      start_time_in_us: agent.options.start_time * 1000,
      end_time_in_us: agent.options.end_time * 1000,
    });
  }, []);

  const periods = agent.periodDataUnit.data[key] ?? [];
  const idx = periods.length - 1;

  useEffect(() => {
    const period = periods[idx];
    if (period) {
      time[idx] = new Date(period.created_at).getTime();
      open[idx] = +period.open;
      high[idx] = +period.high;
      low[idx] = +period.low;
      close[idx] = +period.close;
      volume[idx] = +period.volume;
    }
  });

  return { time, open, high, low, close, volume };
};
