import { decodePath, encodePath } from '@yuants/utils';

/**
 * Interest Rate when holding a product
 *
 * @public
 */
export interface IInterestRate {
  /**
   * Series ID (Encoded as `product_id`)
   */
  series_id: string;
  /**
   * Settlement TimestampTz
   */
  created_at: string;
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
   * 持有多头时，在结算时刻的收益率
   */
  long_rate: string;
  /**
   * 持有空头时，在结算时刻的收益率
   */
  short_rate: string;

  /** 结算价格 */
  settlement_price: string;
}

/**
 * @public
 */
export const encodeInterestRateSeriesId = (product_id: string): string => {
  return product_id;
};

/**
 * @public
 */
export const decodeInterestRateSeriesId = (series_id: string): { product_id: string } => {
  const product_id = (() => {
    try {
      return decodeURIComponent(series_id);
    } catch {
      return series_id;
    }
  })();
  return { product_id };
};

/**
 * 资金费流水
 * @public
 */
export interface IInterestLedger {
  /**
   * 资金费流水记录id
   */
  id: string;
  /**
   * 产品ID
   */
  product_id: string;
  /**
   * 金额
   */
  amount: string;
  /**
   * 账户ID
   */
  account_id: string;
  /**
   * 货币
   */
  currency: string;
  /**
   * 创建时间
   */
  created_at: string;
  /**
   * 更新时间
   */
  updated_at: string;
}

/**
 * @public
 */
export const encodeInterestLedgerSeriesId = (account_id: string, ledger_type: string) =>
  encodePath(...decodePath(account_id), ledger_type);

/**
 * @public
 */
export const decodeInterestLedgerSeriesId = (series_id: string) => {
  const parts = decodePath(series_id);
  const account_id = encodePath(...parts.slice(0, -1));
  const ledger_type = parts[parts.length - 1];
  return { account_id, ledger_type };
};
