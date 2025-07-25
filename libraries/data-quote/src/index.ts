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

  /**
   * Open interest, the total number of open contracts
   *
   * 未平仓合约数，即当前市场上未平仓的合约总数
   */
  open_interest: string;

  /**
   * Interest rate for long positions, the interest rate for holding long positions
   *
   * 多头利率，即持有多头头寸的利率
   */
  interest_rate_long: string;
  /**
   * Interest rate for short positions, the interest rate for holding short positions
   *
   * 空头利率，即持有空头头寸的利率
   */
  interest_rate_short: string;
  /**
   * Previous interest rate settlement time, the last time the interest rate was settled
   *
   * 上次利率结算时间，即上次利率结算的时间
   */
  interest_rate_prev_settled_at: string;
  /**
   * Next interest rate settlement time, the next time the interest rate will be settled
   *
   * 下次利率结算时间，即下次利率结算的预定时间
   */
  interest_rate_next_settled_at: string;
}

AddMigration({
  id: '52dd6e13-6d7d-4fd5-85cc-aa668b7bb44f',
  name: 'create_table_quote',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS quote (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

        last_price TEXT,
        ask_price TEXT,
        ask_volume TEXT,
        bid_price TEXT,
        bid_volume TEXT,
        open_interest TEXT,
        interest_rate_long TEXT,
        interest_rate_short TEXT,
        interest_rate_prev_settled_at TIMESTAMPTZ,
        interest_rate_next_settled_at TIMESTAMPTZ,
        
        PRIMARY KEY (datasource_id, product_id)
    );

    create or replace trigger auto_update_updated_at before update on quote for each row execute function update_updated_at_column();

    CREATE INDEX IF NOT EXISTS idx_quote_updated_at ON quote (updated_at desc);
  `,
});
