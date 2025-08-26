export interface ITrade {
  id: string;
  /**
   * Account ID
   */
  account_id: string;
  /**
   * Product ID
   */
  product_id: string;

  /**
   * Trade Direction
   *
   * - `OPEN_LONG`: Open long position
   * - `CLOSE_LONG`: Close long position
   * - `OPEN_SHORT`: Open short position
   * - `CLOSE_SHORT`: Close short position
   */
  direction: string;

  /**
   * Traded volume
   */
  traded_volume: string;

  /**
   * Traded price
   */
  traded_price: string;

  /**
   * Traded value
   */
  traded_value: string;

  /**
   * Fee
   */
  fee: string;

  /**
   * Fee currency
   */
  fee_currency: string;

  /**
   * Traded At
   */
  created_at?: string;

  /**
   * Last updated timestamp.
   * 最后更新时间戳，使用 RFC-3339 格式，包含时区信息
   */
  updated_at?: string;
}
