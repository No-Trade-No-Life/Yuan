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
