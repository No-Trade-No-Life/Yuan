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
  /**
   * The time interval for interest settlement, measured in milliseconds.
   * 利率结算间隔，即利率结算的间隔时间，单位为毫秒
   */
  interest_rate_settlement_interval: string;
}

/**
 * IQuoteKey 是 IQuote 接口中除 'datasource_id'、'product_id' 和 'updated_at' 之外的所有键的联合类型
 * @public
 */
export type IQuoteKey = Exclude<keyof IQuote, 'datasource_id' | 'product_id' | 'updated_at'>;

/**
 * 用于批量更新的数据结构
 * 结构为：
 * product_id -\> field_name (keyof IQuote) -\> [value: string, updated_at: number]
 * 这样设计的目的是为了减少更新的数据量，同时保留每个字段的更新时间
 *
 * 例如：
 * ```json
 * {
 *   "product_123": {
 *     "last_price": ["100.5", 1627890123456],
 *     "volume": ["1500", 1627890123456]
 *   },
 *   "product_456": {
 *     "last_price": ["200.0", 1627890123456]
 *   }
 * }
 * ```
 * @public
 */
export type IQuoteUpdateAction<K extends IQuoteKey = IQuoteKey> = Record<
  string,
  Partial<Record<K, [value: string, updated_at: number]>>
>;
