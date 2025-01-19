import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    product: IProduct;
  }
}

/**
 * Product: The underlying asset of a transaction.
 * 品种: 交易的标的物
 *
 * @public
 */
export interface IProduct {
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

addDataRecordWrapper('product', (product) => ({
  id: product.product_id,
  type: 'product',
  updated_at: Date.now(),
  tags: {
    datasource_id: '',
    product_id: product.product_id,
    quote_currency: product.quote_currency || '',
    base_currency: product.base_currency || '',
  },
  paths: {
    id: `/${product.product_id}`,
  },
  origin: product,
}));

addDataRecordSchema('product', {
  type: 'object',
  properties: {
    datasource_id: {
      title: '数据源ID',
      type: 'string',
    },
    product_id: {
      title: '品种ID',
      type: 'string',
    },
    name: {
      title: '品种名',
      type: 'string',
      description: '人类易读的品种名称',
    },
    base_currency: {
      title: '基准货币',
      type: 'string',
      description:
        '基准货币是汇率报价中作为基础的货币，即报价表达形式为每一个单位的货币可兑换多少另一种货币。',
    },
    quote_currency: {
      title: '计价货币',
      type: 'string',
    },
    price_step: {
      title: '报价粒度',
      type: 'number',
      description: '市场报价，委托价都必须为此值的整数倍，不得有浮点误差',
    },
    volume_step: {
      title: '成交量粒度',
      type: 'number',
      description: '委托量、成交量、持仓量都必须为此值的整数倍，不得有浮点误差',
    },
    value_scale: {
      title: '价值尺度',
      type: 'number',
      description: '交易 1 手对应的标的资产数量',
    },
    value_scale_unit: {
      title: '价值尺度单位',
      type: 'string',
    },
    margin_rate: {
      title: '保证金率',
      type: 'number',
      description: `
          保证金 = 持仓量 * 持仓价 * 价值速率 * 保证金率 / 账户杠杆率
        `,
    },
    value_based_cost: {
      title: '基于价值的成本',
      type: 'number',
      description: `
        产生与成交额成正比的结算资产成本，例如:
        1. 按成交额收取的手续费
        `,
    },
    volume_based_cost: {
      title: '基于成交量的成本',
      type: 'number',
      description: `
        产生与成交量成正比的结算资产成本，例如:
        1. 按成交量收取的手续费; 
        2. 滑点等交易实况造成的不利价差。
        `,
    },
    max_position: {
      title: '最大持仓量',
      type: 'number',
    },
    max_volume: {
      title: '最大单笔委托量',
      type: 'number',
    },
    min_volume: {
      title: '最小单笔委托量',
      type: 'number',
    },
    allow_long: {
      title: '允许做多',
      type: 'boolean',
      default: true,
    },
    allow_short: {
      title: '允许做空',
      type: 'boolean',
      default: true,
    },
    spread: {
      title: '点差',
      type: 'number',
    },
  },
});

/**
 * @see https://tradelife.feishu.cn/wiki/wikcnRNzWSF7jtkH8nGruaMhhlh
 *
 * @public
 */
export const getProfit = (
  product: IProduct,
  openPrice: number,
  closePrice: number,
  volume: number,
  variant: string,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  (variant === 'LONG' ? 1 : -1) *
  volume *
  (closePrice - openPrice) *
  (product.value_scale ?? 1) *
  (product.value_scale_unit ? 1 / openPrice : 1) *
  (product.quote_currency !== currency
    ? (variant === 'LONG'
        ? quotes(`${product.quote_currency}${currency}`)?.bid
        : quotes(`${product.quote_currency}${currency}`)?.ask) ?? 1
    : 1);

/**
 * @see https://tradelife.feishu.cn/wiki/wikcnEVBM0RQ7pmbNZUxMV8viRg
 *
 * @public
 */
export const getMargin = (
  product: IProduct,
  openPrice: number,
  volume: number,
  variant: string,
  currency: string,
  quote: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  volume *
  (product.value_scale ?? 1) *
  (product.value_scale_unit ? 1 : openPrice) *
  (product.margin_rate ?? 1) *
  (product.quote_currency !== currency
    ? (variant === 'LONG'
        ? quote(`${product.quote_currency}${currency}`)?.bid
        : quote(`${product.quote_currency}${currency}`)?.ask) ?? 1
    : 1);
