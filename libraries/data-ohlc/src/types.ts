/**
 * OHLC: Open-High-Low-Close
 *
 * @public
 */
export interface IOHLC {
  /**
   * Series ID (Encoded as `${product_id}/${duration}`)
   */
  series_id: string;
  /**
   * OHLC Opened TimestampTz (inclusive)
   */
  created_at: string;
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
   * @see https://www.ietf.org/rfc/rfc3339.txt
   *
   * @example
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
  duration: string;
  /**
   * OHLC Closed TimestampTZ (exclusive)
   */
  closed_at: string;
  /**
   * Open Price
   * 开盘价
   */
  open: string;
  /**
   * High Price
   * 最高价
   */
  high: string;
  /**
   * Low Price
   * 最低价
   */
  low: string;
  /**
   * Close Price
   * 收盘价
   */
  close: string;
  /**
   * Volume
   * 成交量
   */
  volume: string;
  /**
   * Open interest
   * 持仓量
   */
  open_interest: string;
}
