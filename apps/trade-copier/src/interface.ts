/**
 * @public
 */
export interface ITradeCopierTradeConfig {
  id?: string;
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
  limit_order_control?: boolean;
}

/**
 * @public
 */
export interface ITradeCopyRelation {
  id?: string;
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
  disabled?: boolean;
}
