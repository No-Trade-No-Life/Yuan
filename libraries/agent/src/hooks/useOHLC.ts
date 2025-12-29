import { useAgent, useEffect, useSeries } from '.';
import { encodeOHLCSeriesId } from '@yuants/data-ohlc';

/**
 * 使用 OHLC(V) 数据
 * @param datasource_id - 数据源ID
 * @param product_id - 品种ID
 * @param period - 周期(秒) 或 周期字符串 (RFC-3339 Duration)
 * @returns
 * @public
 */
export const useOHLC = (product_id: string, duration: string) => {
  const agent = useAgent();
  const series_id = encodeOHLCSeriesId(product_id, duration);

  const time = useSeries(`T(${series_id})`, undefined, {
    type: 'period',
    subType: 'timestamp_in_us',
    product_id,
    duration,
  });
  const open = useSeries(`O(${series_id})`, time);
  const high = useSeries(`H(${series_id})`, time);
  const low = useSeries(`L(${series_id})`, time);
  const close = useSeries(`C(${series_id})`, time);
  const volume = useSeries(`VOL(${series_id})`, time);

  useEffect(() => {
    agent.dataLoadingTaskUnit?.periodTasks.push({
      series_id,
      start_time: agent.options.start_time,
      end_time: agent.options.end_time,
    });
  }, []);

  const periods = agent.periodDataUnit.data[series_id] ?? [];
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
