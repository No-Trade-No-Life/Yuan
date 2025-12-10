/**
 * Order: Changes the {@link @yuants/data-account#IPosition} of the {@link @yuants/data-account#IAccountInfo} in the account through a trading command.
 * 订单: 通过交易命令改变账户内 {@link @yuants/data-account#IAccountInfo} 头寸 {@link @yuants/data-account#IPosition}
 * @public
 */
export interface IOrder {
  /**
   * Order ID
   */
  order_id?: string;
  /**
   * Account ID.
   * 账户 ID
   *
   * {@link @yuants/data-account#IAccountInfo.account_id}
   */
  account_id: string;
  /**
   * Product ID.
   * 品种 ID
   *
   */
  product_id: string;

  /**
   * Specifies the position ID to be operated on.
   * 指定需要操作的头寸 ID
   *
   * - only the matching position can be operated on, and other positions under the same account and product cannot be affected.
   * - 如果填写了，只能操作匹配的头寸，不得影响同账户下同品种下的其他头寸。
   *
   * {@link @yuants/data-account#IPosition.position_id}
   */
  position_id?: string;
  /**
   * Order matching type.
   *
   * - `LIMIT`: Limits the price at which the order can be executed (default)
   * - `MARKET`: Executed at the current market price
   * - `STOP`: Triggers a market order when the market price reaches the order price
   * - `FOK`: Requires immediate and complete
   * - `IOC`: Requires immediate execution, allows partial execution, and cancels the rest
   */
  order_type?: string;
  /**
   * Order direction.
   *
   * - `OPEN_LONG`: Open long position
   * - `CLOSE_LONG`: Close long position
   * - `OPEN_SHORT`: Open short position
   * - `CLOSE_SHORT`: Close short position
   */
  order_direction?: string;
  /**
   * Order Size.
   *
   * 委托净数量，负数代表卖出 (开空/平多)，正数代表买入 (开多/平空)。
   *
   * 使用基础货币单位(标的资产数量)。
   *
   * 如果成交，可以预期 position.size 会相应变化 order.size 的数量。
   *
   * 通过 VEX 代理时，推荐使用这个字段指定下单，可以省略 order_direction 和 volume。
   */
  size?: string;
  /**
   * Whether it is a closing order.
   * 是否为平仓单
   */
  is_close?: boolean;
  /**
   * Order volume.
   * 委托量
   */
  volume: number;
  /**
   * Submit order timestamp.
   */
  submit_at?: number;
  /**
   * Order filled timestamp.
   */
  filled_at?: number;
  /**
   * Last updated timestamp.
   * 最后更新时间戳，使用 RFC-3339 格式，包含时区信息
   */
  updated_at?: string;
  /**
   * Order created timestamp.
   * 订单创建时间戳，使用 RFC-3339 格式，包含时区信息
   */
  created_at?: string;
  /**
   * Order price.
   * 委托价
   */
  price?: number;
  /**
   * Traded volume.
   * 成交量
   */
  traded_volume?: number;
  /**
   * Traded price.
   * 成交价
   */
  traded_price?: number;

  /**
   * Traded value.
   *
   * 成交额
   */
  traded_value?: number;
  /**
   * Order status.
   *
   * - `ACCEPTED`: Order accepted by the exchange
   * - `TRADED`: Order partially filled
   * - `CANCELLED`: Order cancelled
   */
  order_status?: string;
  /**
   * Order comment.
   * 订单注释
   */
  comment?: string;

  /**
   * Profit and loss correction in non-standard models.
   * 非标准模型下的盈亏修正
   *
   * When the profit and loss model is non-standard,
   * a profit and loss correction value can be added to correct the standard model profit and loss to the actual profit and loss.
   * 当盈亏模型非标准时，可以添加一个盈亏修正值，将标准模型盈亏修正到实际盈亏。
   *
   * Profit and loss correction = actual profit and loss - standard profit and loss
   * 盈亏修正 = 实际盈亏 - 标准盈亏
   *
   * If this value is empty, it is semantically equivalent to 0.
   * 如果此值为空，语义等同于 0
   */
  profit_correction?: number;

  /**
   * Actual profit and loss.
   * 实际盈亏
   *
   * The amount of change in the account balance when closing a position.
   * 平仓时，对账户的余额产生的改变量
   *
   * If this value is empty, it is semantically equivalent to "profit_correction == 0", i.e., "standard profit and loss == actual profit and loss".
   * 如果此值为空，语义等同于 "盈亏修正 == 0" 即 "标准盈亏 == 实际盈亏"
   */
  real_profit?: number;

  /**
   * The inferred price of the base currency against the margin currency at the time of closing the position.
   * 推断得到的平仓时基准货币兑保证金货币的价格
   *
   * If this value is empty, it is semantically equivalent to 1 (i.e., the base currency is the same as the margin currency).
   * 如果此值为空，语义等同于 1 (即基准货币 == 保证金货币)
   */
  inferred_base_currency_price?: number;
  /**
   * Take profit price (ignored for now).
   * 止盈价 (暂时不可用)
   * @deprecated to remove
   */
  take_profit_price?: number;
  /**
   * Stop loss price (ignored for now).
   * 止损价 (暂时不可用)
   * @deprecated to remove
   */
  stop_loss_price?: number;
}
