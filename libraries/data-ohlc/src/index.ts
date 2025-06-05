import { AddMigration } from '@yuants/sql';
/**
 * OHLC: Open-High-Low-Close
 *
 * @public
 */
export interface IOHLC {
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
   * OHLC Opened TimestampTz (inclusive)
   */
  opened_at: string;
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

AddMigration({
  id: '5cdf2b48-6264-4d4f-ba4e-3512790d8142',
  name: 'create_table_ohlc',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS ohlc (
      datasource_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      duration TEXT NOT NULL,
      opened_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ NOT NULL,
      open TEXT NOT NULL,
      high TEXT NOT NULL,
      low TEXT NOT NULL,
      close TEXT NOT NULL,
      volume TEXT,
      open_interest TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (datasource_id, product_id, duration, opened_at)
    );

    CREATE INDEX IF NOT EXISTS idx_ohlc_datasource_product_duration_opened_at ON ohlc (datasource_id, product_id, duration, opened_at desc);
  `,
});
