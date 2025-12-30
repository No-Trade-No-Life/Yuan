/**
 * Order: Changes the {@link IPosition} of the {@link IAccountInfo} in the account through a trading command.
 * 订单: 通过交易命令改变账户内 {@link IAccountInfo} 头寸 {@link IPosition}
 * @public
 */
declare interface IOrder {
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
declare interface IPosition {
  /**
   * Position ID.
   * 头寸 ID
   */
  position_id: string;
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

  // Position is one of the reasons for occupying margin,
  // but the calculation mechanism of margin is relatively complex, and the algorithms of various exchanges are different.
  // Therefore, Yuan does not calculate the margin based on the final margin given by the exchange.
  // margin: number;
}
/**
 * Tick: Market transaction data at a certain moment
 * Tick: 某个时刻的市场成交行情数据
 */

declare interface ITick {
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
   * Timestamp (in microseconds)
   * 时间戳
   * @deprecated use updated_at instead
   */
  timestamp_in_us: number;
  /**
   * Timestamp (in ms)
   * 时间戳
   */
  updated_at?: number;
  /**
   * Price
   * 成交价
   */
  price: number;
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
  /**
   * Ask price
   * 卖一价
   */
  ask?: number;
  /** 买一价 */
  bid?: number;
}
/**
 * Account fund information
 *
 * @remarks
 *
 * Net value conforms to the equation:
 *
 * 1. Net value = balance + floating profit and loss
 *
 * 2. Net value = available margin + margin in use
 *
 * If the exchange has provided these fields, use them directly. Otherwise, they can be calculated according to the following algorithm:
 *
 * 1. Floating profit and loss := the sum of the profits and losses formed by the price difference between the current quote and the position price of all positions of the variety
 *
 * 2. Available margin := the margin corresponding to the value of all positions
 *
 * 3. Balance := does not change when opening a position, only when closing a position, the floating profit and loss of the position is added to the balance
 *
 * 4. Net value := balance + floating profit and loss
 *
 * 5. Available margin := net value - margin in use
 *
 * @public
 */
declare interface IAccountMoney {
  /**
   * Settlement currency of the account
   *
   * @example "CNY"
   */
  currency: string;
  /**
   * Net value: equity of the account
   */
  equity: number;
  /**
   * Balance: balance before opening a position
   */
  balance: number;
  /**
   * Floating profit and loss: total floating profit and loss generated by positions in the account
   */
  profit: number;
  /**
   * Available funds/available margin
   */
  free: number;
  /**
   * Used funds/used margin
   */
  used: number;
  /**
   * Account leverage ratio
   */
  leverage?: number;
}

/** Account information @public */
declare interface IAccountInfo {
  /** Account ID */
  account_id: string;
  /** Fund information */
  money: IAccountMoney;
  /** Position information */
  positions: IPosition[];
  /** Unfilled orders */
  orders: IOrder[];
  /**
   * Timestamp when the account information was generated
   *
   * (Used for conflict resolution: always accept the latest information)
   */
  timestamp_in_us: number;
}

/**
 * Product: The underlying asset of a transaction.
 */
declare interface IProduct {
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
   */
  price_step?: number;
  /**
   * Volume unit (unit: lot), default is 1
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
   */
  margin_rate?: number;

  /**
   * Value-based cost
   */
  value_based_cost?: number;
  /**
   * Volume-based cost
   */
  volume_based_cost?: number;

  /**
   * Maximum position
   */
  max_position?: number;
  /** 最大单笔委托量 */
  max_volume?: number;

  /**
   * Allow long
   *
   * If this value is empty, it is semantically equivalent to true.
   */
  allow_long?: boolean;
  /**
   * Allow short
   *
   * If this value is empty, it is semantically equivalent to true.
   */
  allow_short?: boolean;

  /**
   * Spread
   */
  spread?: number;
}

// Basic Hooks
/**
 * Use a reference to a variable to maintain a reference to the same value in all execution stages, similar to React.useRef
 *
 * @param initial_value - The initial value of the reference
 * @returns An object with a `current` property that holds the reference to the value
 */
declare const useRef: <T>(initial_value: T) => { current: T };
/**
 * Use a side effect. When the dependencies of two consecutive calls are different, `fn` will be called again, similar to React.useEffect
 *
 * @param fn - The function to be called as a side effect
 * @param deps - An array of dependencies that trigger the side effect when changed
 */
declare const useEffect: (fn: () => (() => void) | void, deps?: any[]) => void;
/**
 * Cache a calculation, similar to React.useMemo
 *
 * @param fn - The function to be cached
 * @param deps - An array of dependencies that trigger the recalculation of the cached value when changed
 * @returns The cached value
 */
declare const useMemo: <T>(fn: () => T, deps: any[]) => T;
/**
 * Use a state, similar to React.useState
 *
 * @param initState - The initial state value
 * @returns A tuple with the current state value and a function to update the state
 */
declare const useState: <T>(initState: T) => [T, (v: T) => void];
/**
 * Cache a calculation asynchronously, similar to useMemo, but blocks subsequent processes asynchronously
 *
 * @param fn - The function to be cached
 * @param deps - An array of dependencies that trigger the recalculation of the cached value when changed
 * @returns A promise that resolves to the cached value
 */
declare const useMemoAsync: <T>(fn: () => Promise<T>, deps?: any[] | undefined) => Promise<T>;

// Basic parameters
/**
 * Use an JSON Schema parameter
 *
 * @param key - The key of the parameter
 * @param schema - The JSON Schema for the parameter
 * @returns The value of the parameter
 * @see https://json-schema.org/ for JSON Schema Specification
 */
declare const useParamSchema: <T>(key: string, schema: any) => T;

// Series Hook
/** A series is a number[] with some additional fields */
declare class Series extends Array<number> {
  series_id: string;
  name: string | undefined;
  tags: Record<string, any>;
  parent: Series | undefined;
  get currentIndex(): number;
  get previousIndex(): number;
  get currentValue(): number;
  get previousValue(): number;
}
/** Use a series */
declare const useSeries: (name: string, parent: Series | undefined, tags?: Record<string, any>) => Series;

/**
 * Use OHLC Period Data
 * @param datasource_id - Data source ID
 * @param product_id - Product ID
 * @param period - Period in seconds or RFC3339 duration format
 */
declare const useOHLC: (
  datasource_id: string,
  product_id: string,
  period: number | string,
) => {
  time: Series;
  open: Series;
  high: Series;
  low: Series;
  close: Series;
  volume: Series;
};

/**
 * Use Tick
 *
 * @param account_id - The AccountID in Agent
 * @param datasource_id - The DataSourceID in Host
 * @param product_id - The ProductID in the Data Source
 * @returns the Tick data. undefined if not loaded
 */
declare const useTick: (account_id: string, datasource_id: string, product_id: string) => ITick | undefined;

/** Use Account Info */
declare const useAccountInfo: (options?: {
  account_id?: string;
  currency?: string;
  leverage?: number;
  initial_balance?: number;
}) => IAccountInfo;

/** Use Exchange */
declare const useExchange: () => {
  /** Get Quote of Product */
  getQuote: (datasource_id: string, product_id: string) => { ask: number; bid: number };
  /** Get Order by Order ID */
  getOrderById: (id: string) => IOrder | undefined;
  /** List of unfilled orders */
  listOrders: () => IOrder[];
  /** Submit orders */
  submitOrder: (...orders: IOrder[]) => void;
  /** Cancel orders */
  cancelOrder: (...orderIds: string[]) => void;
};

// Utility Hooks
/** Use a logging function */
declare const useLog: () => (...params: any[]) => void;
/** Use a record table */
declare const useRecordTable: <T extends Record<string, any>>(title: string) => T[];
/** Get Time String */
declare const formatTime: (timestamp: number) => string;
/** Generate a UUID (Universal-Unique-ID) */
declare const UUID: () => string;
declare const roundToStep: (
  value: number,
  step: number,
  roundFn?: ((x: number) => number) | undefined,
) => number;

/**
 * convert params to path.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 */
declare const encodePath: (...params: any[]) => string;

/**
 * convert path to params.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
declare const decodePath: (path: string) => string[];

declare const getProfit: (
  product: IProduct,
  openPrice: number,
  closePrice: number,
  volume: number,
  variant: string,
  currency: string,
  quotes: (product_id: string) =>
    | {
        ask: number;
        bid: number;
      }
    | undefined,
) => number;

// Deployment script context
/**
 * Deployment specification: uniquely identifies a deployment by specifying this value
 * @public
 */
declare interface IDeploySpec {
  /**
   * The image tag used for deployment
   */
  version?: string;
  /**
   * The package to be deployed, e.g. \@yuants/hv
   */
  package: string;
  /**
   * Environment variables
   */
  env?: Record<string, string>;
  /**
   * Annotations, which can add some metadata to it
   * e.g. can be used to generate some non-standard resources in the corresponding vendor interpretation
   * Reference: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/
   */
  annotations?: Record<string, string>;
  /**
   * Network configuration
   */
  network?: {
    /**
     * Port forwarding, reference: https://docs.docker.com/config/containers/container-networking/#published-ports
     * Generally, when starting a container, we need to specify [container internal port name]:[container external port]
     * However, here we only specify which port to expose, that is, [container external port], and bind it with the container internal port through a unique semantic name
     * The reason is that only the package can define which port needs to be exposed, and the deployer only defines which port to forward to
     * e.g. vnc -\> 5900, hv -\> 8888
     */
    port_forward?: Record<string, number>;
    /**
     * Reverse proxy,
     * e.g. hv: y.ntnl.io/hv
     */
    backward_proxy?: Record<string, string>;
  };
  /**
   * File system configuration
   * The format is [container internal Volume name]:[container external URI]
   *
   * e.g. config-file1 -\> file://path/to/file
   *      config-file2 -\> s3://bucket_url
   *      config-file3 -\> yuan-workspace://some/path
   */
  filesystem?: Record<string, string>;
  /**
   * CPU resource claim, leaving it blank means using the default value in the package
   */
  cpu?: IResourceClaim;
  /**
   * Memory resource claim, leaving it blank means using the default value in the package
   */
  memory?: IResourceClaim;

  /**
   * Inline JSON data, could be used as a configuration file
   *
   * should be serializable
   */
  one_json?: any;
}

/**
 * Resource claim definition, format reference: https://kubernetes.io/docs/reference/kubernetes-api/common-definitions/quantity/
 * @public
 */
declare interface IResourceClaim {
  /** required */
  min?: string;
  /** limited */
  max?: string;
}

/**
 * Deployment configuration context
 */
declare interface IDeployContext {
  /**
   * bundleCode bundles the entry into IIFE format code
   * @param entry Entry file path
   * @returns IIFE format code
   */
  bundleCode: (entry: string) => Promise<string>;
}

declare const DeployContext: IDeployContext;
