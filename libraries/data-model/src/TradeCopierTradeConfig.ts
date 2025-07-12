/**
 * @public
 */
export interface ITradeCopierTradeConfig {
  id?: string;
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
}
