import { decodePath, encodePath } from '@yuants/utils';

/**
 *
 * @public
 */
export interface ITrade {
  id: string;
  /**
   * Account ID
   */
  account_id: string;
  /**
   * Product ID
   */
  product_id: string;

  /**
   * Trade Direction
   *
   * - `OPEN_LONG`: Open long position
   * - `CLOSE_LONG`: Close long position
   * - `OPEN_SHORT`: Open short position
   * - `CLOSE_SHORT`: Close short position
   */
  direction: string;

  /**
   * Traded volume
   */
  traded_volume: string;

  /**
   * Post-trade volume
   */
  post_volume: string;

  /**
   * Traded price
   */
  traded_price: string;

  /**
   * Traded value
   */
  traded_value: string;

  /**
   * Fee
   */
  fee: string;

  /**
   * Fee currency
   */
  fee_currency: string;

  /**
   * Traded At
   */
  created_at?: string;

  /**
   * Last updated timestamp.
   * 最后更新时间戳，使用 RFC-3339 格式，包含时区信息
   */
  updated_at?: string;
}

/**
 *
 * @public
 */
export interface ITradeHistory {
  id: string;
  /**
   * Account ID
   */
  account_id: string;
  /**
   * product id
   */
  product_id: string;
  /**
   * Trade Direction
   *
   * - `OPEN_LONG`: Open long position
   * - `CLOSE_LONG`: Close long position
   * - `OPEN_SHORT`: Open short position
   * - `CLOSE_SHORT`: Close short position
   */
  direction: string;
  /**
   * size
   */
  size: string;
  /**
   * price
   */
  price: string;
  /**
   * fee
   */
  fee: string;
  /**
   * fee currency
   */
  fee_currency: string;
  /**
   * PnL
   */
  pnl?: string;
  /**
   * Traded At
   */
  created_at: string;
  /**
   * Last updated timestamp.
   * 最后更新时间戳，使用 RFC-3339 格式，包含时区信息
   */
  updated_at: string;
  /**
   * origin data
   */
  origin: Record<string, any>;
}

/**
 * @public
 */
export const encodeTradeHistorySeriesId = (account_id: string, ledger_type: string) =>
  encodePath(...decodePath(account_id), ledger_type);

/**
 * @public
 */
export const decodeTradeHistorySeriesId = (series_id: string) => {
  const parts = decodePath(series_id);
  const account_id = encodePath(...parts.slice(0, -1));
  const ledger_type = parts[parts.length - 1];
  return { account_id, ledger_type };
};
