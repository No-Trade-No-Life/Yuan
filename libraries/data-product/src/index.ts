import { AddMigration } from '@yuants/sql';
/**
 * Product: A tradable object
 * 品种: 可交易对象
 *
 * @public
 */
export interface IProduct {
  /**
   * Data source ID
   *
   * allow empty
   */
  datasource_id: string;
  /**
   * Product ID
   *
   * It's RECOMMENDED that make the product ID the original form from the data source. Don't transform it to somehow standard form.
   */
  product_id: string;
  /** Human-readable product name */
  name: string;
  /**
   * The quote currency to price the product.
   *
   * e.g. "USD", "CNY", "GBP", "USDT", "BTC", ...etc.
   */
  quote_currency: string;

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
  base_currency: string;

  /**
   * price step, default is 1
   * 报价单位，默认为 1
   */
  price_step: number;
  /**
   * Volume unit (unit: lot), default is 1
   * 成交量单位 (单位: 手)，默认为 1
   */
  volume_step: number;
  /**
   * Value scale, default is 1
   *
   * The quantity of the underlying asset specified by one lot.
   */
  value_scale: number;

  /**
   * Unit of value scale.
   *
   * - Leave empty to use the product itself.
   * - If the value is equal to currency, it means that the 1 volume is based on the currency.
   */
  value_scale_unit: string;

  /**
   * Margin rate
   * 保证金率
   */
  margin_rate: number;

  /**
   * Value-based cost
   * 基于价值的成本
   */
  value_based_cost: number;
  /**
   * Volume-based cost
   * 基于成交量的成本
   */
  volume_based_cost: number;

  /**
   * Maximum position
   * 最大持仓量
   */
  max_position: number;
  /** 最大单笔委托量 */
  max_volume: number;

  /**
   * Allow long
   * 允许做多
   *
   * If this value is empty, it is semantically equivalent to true.
   * 如果此值为空，语义上等同于 true.
   */
  allow_long: boolean;
  /**
   * Allow short
   * 允许做空
   *
   * If this value is empty, it is semantically equivalent to true.
   * 如果此值为空，语义上等同于 true.
   */
  allow_short: boolean;
  /**
   * Market id
   * Which market this product belong to, like Binance, OKX etc
   * 该商品属于哪一个市场
   */
  market_id?: string;

  /**
   * No interest rate
   * If this product has interest rate.
   * 该商品是否有资金费率
   */
  no_interest_rate?: boolean;
}

AddMigration({
  id: '7c9189cb-a335-4e95-8174-cd6a975d19a2',
  name: 'create_table_data_product',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS product (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        quote_currency TEXT NOT NULL,
        base_currency TEXT,
        price_step float8 DEFAULT 1 NOT NULL,
        volume_step float8 DEFAULT 1 NOT NULL,
        value_scale float8 DEFAULT 1 NOT NULL,
        value_scale_unit TEXT DEFAULT '' NOT NULL,
        margin_rate float8 DEFAULT 0 NOT NULL,
        value_based_cost float8 DEFAULT 0 NOT NULL,
        volume_based_cost float8 DEFAULT 0 NOT NULL,
        max_position float8 DEFAULT 0 NOT NULL,
        max_volume float8 DEFAULT 0 NOT NULL,
        allow_long BOOLEAN DEFAULT TRUE NOT NULL,
        allow_short BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (datasource_id, product_id)
    );
  `,
});

AddMigration({
  id: 'bb128de2-3f1e-4788-8e13-abae8655b63e',
  name: 'update_table_data_product_add_no_interest_rate',
  dependencies: ['7c9189cb-a335-4e95-8174-cd6a975d19a2'],
  statement: `
        ALTER TABLE public.product
        ADD COLUMN IF NOT EXISTS no_interest_rate BOOLEAN;
    `,
});

AddMigration({
  id: '8451f9eb-31c1-49a5-bc57-83958ff3b52e',
  name: 'alert_table_data_product_add_market_id',
  dependencies: ['7c9189cb-a335-4e95-8174-cd6a975d19a2'],
  statement: `
      ALTER TABLE public.product ADD COLUMN IF NOT EXISTS market_id TEXT;
  `,
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
