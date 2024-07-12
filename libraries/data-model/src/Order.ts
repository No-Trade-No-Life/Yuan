import { addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    order: IOrder;
  }
}

/**
 * Order: Changes the {@link IPosition} of the {@link IAccountInfo} in the account through a trading command.
 * 订单: 通过交易命令改变账户内 {@link IAccountInfo} 头寸 {@link IPosition}
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
   * {@link IAccountInfo.account_id}
   */
  account_id: string;
  /**
   * Product ID.
   * 品种 ID
   *
   * {@link IProduct}
   */
  product_id: string;

  /**
   * Specifies the position ID to be operated on.
   * 指定需要操作的头寸 ID
   *
   * - only the matching position can be operated on, and other positions under the same account and product cannot be affected.
   * - 如果填写了，只能操作匹配的头寸，不得影响同账户下同品种下的其他头寸。
   *
   * {@link IPosition.position_id}
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

addDataRecordWrapper('order', (order) => ({
  id: `${order.account_id}/${order.order_id}`,
  type: `order`,
  created_at: order.submit_at!,
  updated_at: Date.now(),
  frozen_at: order.filled_at!,
  tags: {
    order_id: order.order_id || '',
    account_id: order.account_id,
    product_id: order.product_id,
    order_type: order.order_type || '',
    order_direction: order.order_direction || '',
  },
  origin: order,
}));
