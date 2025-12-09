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
   * Account ID.
   *
   * Suitable for multi-account composition scenarios.
   *
   * - if undefined, it means the position is belong to the account of the account_info.
   * - if defined, it means the position is belong to the account of the account_id.
   */
  account_id?: string;
  /**
   * Position direction (LONG | SHORT)
   *
   * - `"LONG"`: Long position
   * - `"SHORT"`: Short position
   */
  direction?: string;

  /**
   * Base currency of the position.
   * 头寸的基础货币
   */
  base_currency?: string;
  /**
   * Quote currency of the position.
   * 头寸的报价货币
   */
  quote_currency?: string;
  /**
   * Size of the position. negative for short positions. Normalized by value_scale.
   * 净头寸的大小，已经按照 value_scale 归一化。空头为负数
   */
  size?: string;
  /**
   * Free size of the position. Negative for short positions. Normalized by value_scale.
   * 净头寸的可用大小，已经按照 value_scale 归一化。空头为负数
   */
  free_size?: string;

  /**
   * Liquidation price of the position. (Approximate value). Due to the complexity of margin calculation mechanisms, it is usually provided by the exchange.
   * 持仓的强平价格 (预估值)，由于保证金计算机制复杂，通常由交易所给出。
   */
  liquidation_price?: string;
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
   * Settlement interval in milliseconds.
   * 结算间隔时间，单位毫秒
   */
  settlement_interval?: number;
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

  /**
   * 使用的保证金
   * Used margin
   *
   * NOTE: 保证金是占用资金的一种原因，但保证金的计算机制相对复杂，各个交易所的算法不同。
   */
  margin?: number;

  /**
   * 已实现盈亏
   *
   * Realized PnL
   */
  realized_pnl?: number;

  /**
   * 已开仓总量
   *
   * Total opened volume
   */
  total_opened_volume?: number;
  /**
   * 已平仓总量
   *
   * Total closed volume
   */
  total_closed_volume?: number;

  /**
   * 创建时间
   */
  created_at?: number;
  /**
   * 更新时间
   */
  updated_at?: number;

  /**
   * 已实现盈亏的平均价格 = 已实现盈亏 / 已平仓总量
   * Average price of realized PnL
   */
  // realized_position_price?: number;
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

/**
 * 账户信息
 *
 * @public
 */
export interface IAccountInfo {
  /**
   * Account ID
   *
   * 账户ID
   */
  account_id: string;
  /**
   * Money information.
   * 资金信息
   */
  money: IAccountMoney;

  /**
   * Position information
   *
   * 持仓信息
   */
  positions: IPosition[];

  /**
   * Timestamp when the account information was generated
   *
   * 账户信息产生的时间戳
   *
   * (Used to handle conflicts: always accept the latest information)
   *
   * (用于处理冲突: 应当总是接受最新的信息)
   */
  updated_at: number;
}

/**
 * IPositionDiff: Represents the difference between two positions.
 *
 * @public
 */
export interface IPositionDiff {
  /** Product ID */
  product_id: string;
  /** position variant LONG/SHORT */
  direction: string;
  /** source volume */
  volume_in_source: number;
  /** Target volume */
  volume_in_target: number;
  /** Error Volume */
  error_volume: number;
}

/**
 * IAccountInfoInput: Input structure for account information.
 * 账户信息的输入结构
 *
 * @public
 */
export type IAccountInfoInput = {
  account_id: string;
  updated_at: number;
  money: Pick<IAccountMoney, 'currency' | 'equity' | 'free'>;
  positions: IPosition[];
};
