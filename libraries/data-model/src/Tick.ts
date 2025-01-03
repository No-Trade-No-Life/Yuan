/**
 * Tick: Market data at a certain moment
 * Tick: 某个时刻的市场数据
 * @public
 */

export interface ITick {
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
   * Timestamp (in ms)
   * 时间戳
   */
  updated_at: number;
  /**
   * Price
   * 成交价
   */
  price?: number;
  /**
   * Volume
   * 成交量
   */
  volume?: number;
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
  /**
   * Ask price
   * 卖一价
   */
  ask?: number;
  /** 买一价 */
  bid?: number;
  /**
   * Next timestamp for settlement
   */
  settlement_scheduled_at?: number;
  /**
   * Current Interest Rate if you hold long position
   *
   * You will get the interest (rate * valuation) when the next settlement.
   */
  interest_rate_for_long?: number;
  /**
   * Current Interest Rate if you hold short position
   *
   * You will get the interest (rate * valuation) when the next settlement.
   */
  interest_rate_for_short?: number;
}

declare module './DataRecord' {
  export interface IDataRecordTypes {
    tick: ITick;
  }
}
