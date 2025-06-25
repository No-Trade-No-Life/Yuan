import { AddMigration } from '@yuants/sql';
/**
 * Quote is Level-1 data of the Product
 *
 * @public
 */
export interface IQuote {
  /**
   * Data source ID
   */
  datasource_id: string;
  /**
   * Product ID
   */
  product_id: string;

  /**
   * Last updated time, in RFC-3339 format with timezone
   *
   * 最后更新时间，使用 RFC-3339 格式，包含时区信息
   */
  updated_at: string;

  /**
   * Last price, the most recent price of the product
   *
   * 最后成交价，即产品的最新价格
   */
  last_price: string;

  /**
   * Ask price, the lowest price to sell
   *
   * 卖一价，即卖方愿意接受的最低价格
   */
  ask_price: string;
  /**
   * Ask volume, the volume at ask price
   *
   * 卖一量，即卖方愿意接受的最低价格的成交量
   */
  ask_volume: string;
  /**
   * Bid price, the highest price to buy
   *
   * 买一价，即买方愿意支付的最高价格
   */
  bid_price: string;
  /**
   * Bid volume, the volume at bid price
   *
   * 买一量，即买方愿意支付的最高价格的成交量
   */
  bid_volume: string;
}

AddMigration({
  id: '9ffcabfd-6968-435d-a15e-93f35722dbfa',
  name: 'create_table_quote',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS quote (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        last_price TEXT NOT NULL,
        ask_price TEXT NOT NULL,
        ask_volume TEXT NOT NULL,
        bid_price TEXT NOT NULL,
        bid_volume TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (datasource_id, product_id)
    );

    create or replace trigger auto_update_updated_at before update on quote for each row execute function update_updated_at_column();

    CREATE INDEX IF NOT EXISTS idx_quote_updated_at ON quote (updated_at desc);
  `,
});
