/**
 * Period: Market transaction data during a certain period of time
 * Period: 某个时间段内的市场成交行情数据
 * @public
 */
export interface IPeriod {
  /**
   * Data source ID
   * 数据源 ID
   */
  datasource_id: string;
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
