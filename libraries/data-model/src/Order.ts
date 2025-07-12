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
 * 初始化 - 本地订单簿 - (触发) 下游服务 - (回报) 订单管理服务
 *
 * 可能还要多次触发，直到订单结束
 *
 * 触发给下游服务之前，需要进行检查，是否满足触发条件和执行条件
 *
 * @alpha
 */
export interface IStandardOrder {
  /**
   * 当前订单的 UUID, 唯一标识
   *
   * 推荐为 UUID
   */
  order_id: string;

  /**
   * 上游传过来的订单 ID (如果有)
   *
   * 如果留空，表明是最上游的订单，通常是用户提交的订单
   *
   * 传统概念例子:
   * - order_client_id: 客户端订单 ID
   */
  order_upstream_id?: string;
  /**
   * 下游传回来的订单 ID (如果有)
   *
   * 如果留空，表明是最下游的订单，通常是交易所的订单
   *
   * 传统概念例子:
   * - order_exchange_id: 交易所订单 ID
   */
  order_downstream_id?: string;
  /**
   * 品种全局唯一标识 (e.g. FUTURES/ESZ2023, FOREX/NDF_USDCNY_202312)
   *
   * 同一 product_id 有同一报价
   *
   * - 期权的 CALL / PUT 由 product_id 区分
   */
  product_id: string;
  /**
   * 基础资产
   *
   * (e.g. BTC, ESZ2023)
   */
  // base_asset: string;
  /**
   * 计价资产
   *
   * (e.g. USD, USDT)
   */
  // quote_asset: string;

  /**
   * 账户标识 (推荐格式: exchange/account_type/id[/position_id])
   *
   * 如果账户内有多个同品种的头寸，可以通过 position_id 区分
   *
   * 例如多头和空头同时存在的情形
   */
  account_id: string;
  /**
   * 交易方向
   *
   * - BUY: 用 quote 换 base
   * - SELL: 用 base 换 quote
   *
   * 传统概念例子:
   * - BUY: 买入 base
   * - SELL: 卖出 base
   * - OPEN_LONG: 开多 base, 填 "BUY"
   * - CLOSE_LONG: 平多 base, 填 "SELL"
   * - OPEN_SHORT: 开空 base, 填 "SELL"
   * - CLOSE_SHORT: 平空 base, 填 "BUY"
   *
   * 对保证金头寸的操作: 默认使用单向头寸，即只能开多或开空，不能同时开多空。
   * - 如果需要同时开多空，考虑通过不同的 position_id 区分。
   * - 全仓模式+双边头寸模式下，多空头寸的 position_id 应当不同。
   * - 隔仓模式下，每个仓位拥有单独的保证金和方向，应当通过 position_id 区分。
   */
  direction: 'BUY' | 'SELL';

  /**
   * 精确资产数量 (精确字符串表示)
   *
   * 表明订单的执行任务量
   *
   * 当 executed_amount 达到 amount 时，订单完成
   */
  amount: string;
  /**
   * 数量类型
   *
   * - `BASE`: 数量解释为基础资产
   * - `QUOTE`: 数量解释为计价资产
   */
  amount_type: 'BASE' | 'QUOTE';

  /**
   * 执行价格 (精确字符串表示)
   *
   * 与方向有关:
   * - BUY: 价格必须低于等于执行价格，才能成交
   * - SELL: 价格必须高于等于执行价格，才能成交
   *
   * 交易滑点 (slipage) 可以通过额外乘以滑点系数来实现
   * - BUY: 执行价格 *= (1 + slipage)
   * - SELL: 执行价格 *= (1 - slipage)
   *
   * 传统概念例子:
   * - MARKET, STOP 单 不填
   * - LIMIT, STOP_LIMIT 单 必填
   * - IOC, FOK 单 选填
   */
  execution_price?: string;

  /**
   * 触发价格 (精确字符串表示)
   *
   * 默认不通过价格控制触发
   *
   * 与方向有关:
   * - BUY: 当市价达到或超过触发价格时，订单会发送给下游服务
   * - SELL: 当市价达到或低于触发价格时，订单会发送给下游服务
   *
   * 传统概念例子:
   * - STOP, STOP_LIMIT 单必填
   * - MARKET, LIMIT 单不填
   */
  trigger_price?: string;

  /**
   * 订单取消时间 (ISO 8601 格式 + 时区)
   *
   * 如果订单于此时间时没有进入最终状态 (COMPLETE / ERROR)，将自动进入取消状态
   *
   * 传统概念例子:
   * - GTC (Good Till Cancel): 不填，无取消时间
   * - IOC (Immediate Or Cancel), FOK (Fill Or Kill): 不填，不通过时间控制
   * - DAY (Day): 填当日交易所闭市时间，当日未成交则取消，留挂单
   * - GTD (Good Till Date): 填指定时间，到期自动取消，留挂单
   *
   * - 建议用 formatTime 转换
   */
  cancel_at?: string;

  /**
   * 最小执行数量 (精确字符串表示)
   *
   * 默认为 0，表示无最小执行数量限制，允许部分成交
   *
   * 传统概念例子:
   * - IOC (Immediate Or Cancel): 不填，无最小执行数量限制
   * - FOK (Fill Or Kill), MARKET: 填订单数量，必须全部成交
   * - TWAP, VWAP, ICEBERG: 填订单数量的一部分，可以约束拆单算法交易的最小数量
   */
  min_execution_amount?: string;
  /**
   * 最大触发数量 (精确字符串表示)
   *
   * 默认为 quantity，表示无最大触发数量限制
   *
   * 传统概念例子:
   * - IOC (Immediate Or Cancel), FOK (Fill Or Kill): 不填，无最大执行数量限制
   * - TWAP, VWAP, ICEBERG: 填订单数量的一部分，可以约束拆单算法交易的最大数量
   */
  max_trigger_amount?: string;

  /**
   * 最大触发次数
   *
   * 订单超过最大触发次数后，将自动取消
   *
   * 默认为 `"1"`，表示仅触发一次，失败后取消。
   *
   * 一旦允许多次触发，系统会调用额外的订单簿管理订单触发状态。
   *
   * 传统概念例子:
   * - MARKET, IOC, FOK 单 填 `"1"`，或者不填, 触发后如果无法执行则取消
   * - TWAP, VWAP, ICEBERG 单 填 `"Infinity"`，或者某个固定数字，确保订单多次触发（但如果下游支持这些订单，可以不填）。
   *
   * 需要挂单的情况:
   * - 如果下游服务不支持挂单，可以填 `"Infinity"`，支持无限次触发；或者某个固定数字，支持有限次数触发。
   * - 如果下游服务支持挂单，可以填 `"1"`，仅触发一次，失败后取消。
   */
  max_trigger_times?: string;

  /**
   * 仅做市订单
   *
   * 做市订单仅提供流动性，不主动成交。
   *
   * 默认为 false，表示不限制成交方式 (MAKER / TAKER)
   *
   * 这是一个对下游服务的建议，如果下游服务不支持仅做市，必须拒绝订单
   *
   * 传统概念例子:
   * - CLOB (Central Limit Order Book): 如果下游服务支持仅挂单，可以填 `true`，否则拒绝订单
   */
  maker_only?: boolean;

  /**
   * 代理 ID
   *
   * 如果留空，表示不选择特定的代理
   *
   * 传统概念例子:
   * - 中心化交易所 (CEX): 填写券商代码。
   * - 区块链交易所 (DEX): 一般支持 RPC 节点，可以填写代理 ID。
   */
  broker_id?: string;
  /**
   * 最大代理执行费用 (精确字符串表示)
   *
   * 默认不限制代理费用
   *
   * 传统概念例子:
   * - 中心化交易所 (CEX): 一般不支持定制代理费用，不填。
   * - 区块链交易所 (DEX): 一般支持定制执行费用 (gas)。
   */
  max_broker_execution_fee?: string;
  /**
   * 代理优先费用 (精确字符串表示)
   *
   * 默认为 0，表示无代理费用
   *
   * 传统概念例子:
   * - 中心化交易所 (CEX): 一般不支持定制费用，不填。
   * - 区块链交易所 (DEX): 一般支持定制费用，可以填写最大代理优先费用，priority 费。
   */
  broker_priority_fee?: string;
}
