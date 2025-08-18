import { AddMigration } from '@yuants/sql';
/**
 * Interest Rate when holding a product
 *
 * @public
 */
export interface IInterestRate {
  /**
   * Series ID (Encoded as `encodePath(datasource_id, product_id)`)
   */
  series_id: string;
  /**
   * Settlement TimestampTz
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
   * 持有多头时，在结算时刻的收益率
   */
  long_rate: string;
  /**
   * 持有空头时，在结算时刻的收益率
   */
  short_rate: string;

  /** 结算价格 */
  settlement_price: string;
}

AddMigration({
  id: '0ed605e6-59f0-4684-a65a-54328e2af50f',
  name: 'create_table_interest_rate',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS interest_rate (
      series_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      datasource_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      long_rate TEXT NOT NULL,
      short_rate TEXT NOT NULL,
      settlement_price TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (series_id, created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_interest_rate_series_id_created_at ON interest_rate (series_id, created_at desc);
    create or replace trigger auto_update_updated_at before update on interest_rate for each row execute function update_updated_at_column();
  `,
});
