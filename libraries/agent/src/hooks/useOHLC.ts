import { useAgent, useEffect, useMemo, useSeries } from '.';
import { decodePath } from '../utils';

/**
 * 使用 OHLC(V) 数据
 * @param datasource_id - 数据源ID
 * @param product_id - 品种ID
 * @param period_in_sec - 周期(秒)
 * @returns
 * @public
 */
export const useOHLC = (datasource_id: string, product_id: string, period_in_sec: number) => {
  const agent = useAgent();
  const key = [datasource_id, product_id, period_in_sec].join(); // TODO: Memoize Key

  const time = useSeries(`T(${key})`, undefined, {
    type: 'period',
    subType: 'timestamp_in_us',
    datasource_id,
    product_id,
    period_in_sec,
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
      period_in_sec,
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

/**
 * 使用参数 (OHLC)
 * @param key - 参数名
 * @public
 */
export const useParamOHLC = (key: string) => {
  const agent = useAgent();
  useEffect(() => {
    agent.paramsSchema.properties![key] = {
      type: 'string',
      format: 'OHLC-key',
    };
  }, []);
  const { datasource_id, product_id, period_in_sec } = useMemo(() => {
    const [datasource_id = '', product_id = '', _period_in_sec] = decodePath(agent.params[key] || '');
    const period_in_sec = +_period_in_sec;
    return { datasource_id, product_id, period_in_sec };
  }, [agent.params[key]]);

  const periods = useOHLC(datasource_id, product_id, period_in_sec);
  return { datasource_id, product_id, period_in_sec, ...periods };
};
