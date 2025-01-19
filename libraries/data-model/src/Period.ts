import { addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    period: IPeriod;
  }
}

/**
 * Period: Market transaction data during a certain period of time
 * Period: 某个时间段内的市场成交行情数据
 * @public
 */
export interface IPeriod {
  /**
   * Product ID
   * 品种 ID
   */
  product_id: string;
  /**
   * duration, in RFC3339 Duration format
   *
   * - `PT1M`: 1 minute
   * - `PT5M`: 5 minutes
   * - `PT15M`: 15 minutes
   * - `PT30M`: 30 minutes
   * - `PT1H`: 1 hour
   * - `PT2H`: 2 hours
   * - `PT4H`: 4 hours
   * - `P1D`: 1 day
   * - `P1W`: 1 week
   * - `P1M`: 1 month
   * - `P1Y`: 1 year
   */
  duration?: string;
  /**
   * Period (in seconds)
   * 时间周期 (秒)
   * @deprecated use duration instead
   */
  period_in_sec: number;
  /**
   * Start timestamp (open, in microseconds)
   * 开始时间戳 (open)
   * @deprecated use start_at instead
   */
  timestamp_in_us: number;
  /**
   * Start timestamp (in ms)
   */
  start_at?: number;
  /**
   * Open price
   * 开盘价
   */
  open: number;
  /**
   * Highest price
   * 最高价
   */
  high: number;
  /**
   * Lowest price
   * 最低价
   */
  low: number;
  /**
   * Closed price
   * 收盘价
   */
  close: number;
  /**
   * Volume
   * 成交量
   */
  volume: number;
  /**
   * Open interest
   * 持仓量
   */
  open_interest?: number;
  /**
   * Spread
   * 点差
   */
  spread?: number;
}

addDataRecordWrapper('period', (period) => {
  const period_end_time = period.timestamp_in_us / 1000 + period.period_in_sec * 1000;
  return {
    id: `${period.product_id}/${period.duration}/${period.start_at}`,
    type: `period`,
    created_at: period.timestamp_in_us / 1000,
    updated_at: Date.now(),
    frozen_at: period_end_time < Date.now() ? period_end_time : null,
    tags: {
      product_id: period.product_id,
      duration: period.duration || '',
      period_in_sec: '' + period.period_in_sec,
    },
    paths: {
      id: `/${period.product_id}/${period.duration}`,
    },
    origin: period,
  };
});
