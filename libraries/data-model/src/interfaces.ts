/**
 * Product: The underlying asset of a transaction.
 * 品种: 交易的标的物
 *
 * @public
 */
export interface IProduct {
  /** Data source ID */
  datasource_id: string;
  /**
   * Product ID
   *
   * It's RECOMMENDED that make the product ID the original form from the data source. Don't transform it to somehow standard form.
   */
  product_id: string;
  /** Human-readable product name */
  name?: string;
  /**
   * The quote currency to price the product.
   *
   * e.g. "USD", "CNY", "GBP", "USDT", "BTC", ...etc.
   */
  quote_currency?: string;

  /**
   * Base Currency
   *
   * Only available in foreign exchange products.
   *
   * If defined, the price of this product (P(this, quote_currency)) can be treated as P(base_currency, quote_currency)
   *
   * The base currency is the currency used as the basis for exchange rate quotes, expressed as the number of units of the currency that can be exchanged for one unit of the quoted currency.
   *
   * e.g. The base currency of GBPJPY is GBP; the base currency of USDCAD is USD.
   *
   */
  base_currency?: string;

  /**
   * price step, default is 1
   * 报价单位，默认为 1
   */
  price_step?: number;
  /**
   * Volume unit (unit: lot), default is 1
   * 成交量单位 (单位: 手)，默认为 1
   */
  volume_step?: number;
  /**
   * Value scale, default is 1
   *
   * The quantity of the underlying asset specified by one lot.
   */
  value_scale?: number;

  /**
   * Unit of value scale.
   *
   * - Leave empty to use the product itself.
   * - If the value is equal to currency, it means that the 1 volume is based on the currency.
   */
  value_scale_unit?: string;

  /**
   * Margin rate
   * 保证金率
   */
  margin_rate?: number;

  /**
   * Value-based cost
   * 基于价值的成本
   */
  value_based_cost?: number;
  /**
   * Volume-based cost
   * 基于成交量的成本
   */
  volume_based_cost?: number;

  /**
   * Maximum position
   * 最大持仓量
   */
  max_position?: number;
  /** 最大单笔委托量 */
  max_volume?: number;

  /**
   * Allow long
   * 允许做多
   *
   * If this value is empty, it is semantically equivalent to true.
   * 如果此值为空，语义上等同于 true.
   */
  allow_long?: boolean;
  /**
   * Allow short
   * 允许做空
   *
   * If this value is empty, it is semantically equivalent to true.
   * 如果此值为空，语义上等同于 true.
   */
  allow_short?: boolean;

  /**
   * Spread
   * 预期点差
   */
  spread?: number;
}

/**
 * Period: Market transaction data during a certain period of time
 * Period: 某个时间段内的市场成交行情数据
 * @public
 */

export interface IPeriod {
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
  duration?: string;
  /**
   * Period (in seconds)
   * 时间周期 (秒)
   * @deprecated use duration instead
   */
  period_in_sec: number;
  /**
   * Start timestamp (open, in microseconds)
   * 开始时间戳 (open)
   * @deprecated use start_at instead
   */
  timestamp_in_us: number;
  /**
   * Start timestamp (in ms)
   */
  start_at?: number;
  /**
   * Open price
   * 开盘价
   */
  open: number;
  /**
   * Highest price
   * 最高价
   */
  high: number;
  /**
   * Lowest price
   * 最低价
   */
  low: number;
  /**
   * Closed price
   * 收盘价
   */
  close: number;
  /**
   * Volume
   * 成交量
   */
  volume: number;
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

/**
 * Position: Atomic position information.
 * 原子性的持仓头寸信息
 *
 * Positions on the same product can be aggregated.
 * 相同品种上的头寸可以被合计
 *
 * @public
 */
export interface IPosition {
  /**
   * Position ID.
   * 头寸 ID
   */
  position_id: string;
  /**
   * DataSource ID
   * 数据源 ID
   */
  datasource_id?: string;
  /**
   * Product ID.
   * 品种 ID
   */
  product_id: string;
  /**
   * Position direction (LONG | SHORT)
   *
   * - `"LONG"`: Long position
   * - `"SHORT"`: Short position
   */
  direction?: string;
  /**
   * Position volume (non-negative).
   * 持仓量 (非负)
   *
   * When calculating net value, this field should be referenced.
   * 结算净值时应参考此字段
   */
  volume: number;
  /**
   * Tradable volume (non-negative).
   * 可交易量 (非负)
   *
   * When placing an order, this field should be referenced.
   * 下单时应检查此字段
   *
   * For T+0 trading, this field should be consistent with the volume field;
   * 市场为 T+0 交易时应当与 volume 字段一致;
   * For T+1 trading, this field may be smaller than the volume field.
   * 市场为 T+1 交易时，可能比 volume 小.
   */
  free_volume: number;
  /**
   * Position price.
   * 持仓成本价 (可通过 product_id 得到价格的内在含义)
   */
  position_price: number;

  /**
   * The current closable settlement price.
   * 当前可平仓结算价格
   */
  closable_price: number;

  /**
   * Floating profit and loss of the position.
   * 持仓浮动盈亏
   */
  floating_profit: number;

  /**
   * the comment of the position.
   * 头寸的备注
   */
  comment?: string;

  /**
   * The valuation of the position. (unit: account currency)
   * 头寸的估值 (单位: 账户货币)
   *
   * 无法估值的情况可以暂时填写为 0
   */
  valuation: number;
  /**
   * Next timestamp for settlement
   * 下次结算时间戳
   */
  settlement_scheduled_at?: number;
  /**
   * The interest to gain when next settlement.
   * 下次结算时获得的利息
   */
  interest_to_settle?: number;

  // Position is one of the reasons for occupying margin,
  // but the calculation mechanism of margin is relatively complex, and the algorithms of various exchanges are different.
  // Therefore, Yuan does not calculate the margin based on the final margin given by the exchange.
  // margin: number;
}

/**
 * Account money information.
 * 账户资金信息
 *
 * @remarks
 *
 * Net value satisfies the equation:
 * 净值符合方程:
 *
 * 1. Net value = balance + floating profit and loss
 * 1. 净值 = 余额 + 浮动盈亏
 *
 * 2. Net value = available margin + occupied margin
 * 2. 净值 = 可用保证金 + 占用保证金
 *
 * If the exchange has provided these fields, use them directly. Otherwise, they can be calculated using the following algorithm:
 * 如果交易所已提供这些字段，直接用交易所的。否则可以根据如下算法计算:
 *
 * 1. Floating profit and loss := the sum of the profit and loss formed by the difference between the current price and the position price of all positions on the product.
 * 1. 浮动盈亏 := 所有头寸的品种的当前报价和持仓价的价差形成的盈亏之和
 *
 * 2. Available margin := the margin corresponding to the value of all positions.
 * 2. 可用保证金 := 所有头寸的价值所对应的保证金
 *
 * 3. Balance := does not change when opening a position, only when closing a position will the floating profit and loss of the position be added to the balance.
 * 3. 余额 := 开仓时不会变，仅平仓的时候会将头寸的浮动盈亏加入余额
 *
 * 4. Net value := balance + floating profit and loss
 * 4. 净值 := 余额 + 浮动盈亏
 *
 * 5. Available margin := net value - occupied margin
 * 5. 可用保证金 := 净值 - 占用保证金
 *
 * @public
 */
export interface IAccountMoney {
  /**
   * Settlement currency of the account.
   * 账户的结算货币
   *
   * @example "CNY"
   */
  currency: string;
  /**
   * Net value: equity of the account.
   * 净值: 账户的权益
   */
  equity: number;
  /**
   * Balance: balance before opening a position.
   * 余额: 开仓前的余额
   */
  balance: number;
  /**
   * Floating profit and loss: the total floating profit and loss generated by the positions in the account.
   * 浮动盈亏: 持仓中的头寸产生的总浮动盈亏
   */
  profit: number;
  /**
   * Available margin.
   * 可用资金/可用保证金
   */
  free: number;
  /**
   * Used margin.
   * 已用资金/已用保证金
   */
  used: number;

  /**
   * Margin ratio.
   * 账户杠杆率
   */
  leverage?: number;
}

/** 账户信息 @public */
export interface IAccountInfo {
  /**
   * Account ID.
   * 账户ID
   */
  account_id: string;
  /**
   * Money information.
   * 资金信息
   */
  money: IAccountMoney;
  /**
   * Position information.
   * 持仓信息
   */
  positions: IPosition[];
  /**
   * Unfilled orders.
   * 未成交的挂单
   */
  orders: IOrder[];
  /**
   * Timestamp when the account information was generated.
   * 账户信息产生的时间戳
   *
   * (Used to handle conflicts: always accept the latest information)
   * (用于处理冲突: 应当总是接受最新的信息)
   */
  updated_at?: number;
  /**
   * Timestamp when the account information was generated.
   * 账户信息产生的时间戳
   *
   * (Used to handle conflicts: always accept the latest information)
   * (用于处理冲突: 应当总是接受最新的信息)
   *
   * @deprecated use updated_at instead
   */
  timestamp_in_us?: number;
}

/**
 * Data Record
 * 数据记录
 *
 * @public
 */
export interface IDataRecord<T = unknown> {
  /**
   * Record ID
   * 记录的标识符
   */
  id: string;
  /**
   * Record type
   * 记录的类型
   *
   * Different types should have consistent schema and are recommended to be stored in different tables to avoid excessive index space usage in the table
   * 不同的类型应当具有一致的 schema，并推荐存储到不同的表中，避免该表使用的索引空间增长过快
   */
  type: string;
  /**
   * Timestamp when the record was created (in ms)
   * 记录被创建的时间戳 (in ms)
   *
   * null represents -Infinity, which means infinitely far in the past
   * null 代表 -Infinity, 即过去的无穷远处
   */
  created_at: number | null;
  /**
   * Timestamp when the record was updated (in ms)
   * 记录更新的时间戳 (in ms)
   *
   * When there are multiple copies of the same record, the largest value of this field should be used.
   * 同一记录存在多份时，应以此字段最大者为准。
   */
  updated_at: number;
  /**
   * Timestamp when the record was frozen (in ms)
   * 记录冻结的时间戳 (in ms)
   *
   * After this point in time, the record will no longer be updated and can be cached on any terminal.
   * 在此时间点之后，记录将不再更新，可以任意被缓存到各终端
   *
   * null represents Infinity, which means infinitely far in the future.
   * null 代表 Infinity, 即未来的无穷远处
   */
  frozen_at: number | null;

  /**
   * Timestamp when the record will expire (in ms)
   * 记录过期的时间戳 (in ms)
   *
   * After this point in time, the record will be deleted.
   * 在此时间点之后，记录将被删除
   *
   * undefined represents Infinity, which means infinitely far in the future.
   * undefined 代表 Infinity, 即未来的无穷远处
   */
  expired_at?: number;
  /**
   * Fields that can be used as quick search conditions
   * 可以作为快速检索条件的字段
   *
   * When stored, the value will be converted to a string.
   * 存储时，值会被 toString
   */
  tags: Record<string, string>;
  /**
   * The original value of the record, which does not support efficient retrieval.
   */
  origin: T;
}
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

/**
 * ITransferOrder represents the transfer order, will be updated by both side during the transfer process
 *
 * ITransferOrder 表示转账订单，将在转账过程中双方更新
 *
 * @public
 */
export interface ITransferOrder {
  /**
   * Order ID
   *
   * 订单 ID
   */
  order_id: string;
  /**
   * Created Timestamp
   *
   * 创建时间戳
   */
  created_at: number;
  /**
   * Updated Timestamp
   *
   * 最后更新时间戳
   */
  updated_at: number;
  /**
   * Credit Account ID
   *
   * 贷方账户 ID (付款方)
   */
  credit_account_id: string;
  /**
   * Debit Account ID
   *
   * 借方账户 ID (收款方)
   */
  debit_account_id: string;
  /**
   * Currency
   *
   * 转账货币
   */
  currency: string;
  /**
   * Expected Amount
   *
   * 预期转账金额
   */
  expected_amount: number;
  /**
   * Order Status
   *
   * - `"COMPLETE"` - Transfer completed
   * - `"ERROR"` - Transfer failed, need to check the error message, need human intervention
   * - `"AWAIT_DEBIT"` - Waiting for the debit side to handle / confirm
   * - `"AWAIT_CREDIT"` - Waiting for the credit side to handle / confirm
   */
  status: string;
  /**
   * Error Message for Human-reading
   *
   * 人类可读的错误信息
   */
  error_message?: string;
  /**
   * Timeout Timestamp
   *
   * 超时时间戳
   */
  timeout_at: number;

  /**
   * The acceptable ways for Debit Account to receive the transfer (Routing Path)
   *
   * 借方可接受的转账方式 (Routing Path)
   */
  debit_methods?: string[];

  /**
   * The confirmed way for credit account to send the transfer (Routing Path)
   *
   * 贷方选择的转账方式 (Routing Path)
   */
  credit_method?: string;

  /**
   * Transfer Initiated Timestamp
   *
   * 贷方发起转账的时间戳
   */
  transferred_at?: number;
  /**
   * Transfer Initiated Amount
   *
   * 贷方已经发送的金额
   */
  transferred_amount?: number;
  /**
   * Transaction ID for confirmation
   *
   * 转账凭证号
   */
  transaction_id?: string;

  /**
   * Received Timestamp for Debit Account
   *
   * 借方查收到帐的时间戳
   */
  received_at?: number;
  /**
   * Received Amount for Debit Account
   *
   * 借方已经收到的金额
   */
  received_amount?: number;
}
