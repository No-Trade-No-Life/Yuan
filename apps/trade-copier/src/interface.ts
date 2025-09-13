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

export type ITradeCopierStrategyBase = {
  /**
   * 策略类型
   */
  type?: string;
  /**
   * 最大订单量限制
   */
  max_volume?: number;
};

export type ITradeCopierStrategyConfig = {
  /**
   * 全局默认配置
   */
  global?: ITradeCopierStrategyBase;
  /**
   * 按照 product_id 特殊覆盖的配置
   */
  product_id_overrides?: Record<string, ITradeCopierStrategyBase>;
};

/**
 * @public
 */
export interface ITradeCopierConfig {
  /**
   * 实际账户 ID
   *
   * - (强制) 预期账户 ID 格式: `TradeCopier/Expected/${account_id}`
   * - (建议) 预览账户 ID 格式: `TradeCopier/Preview/${account_id}`
   *
   * (防呆设计) 建议在使用时，先配置预览账户，确认无误后，再发布配置到预期账户。直接修改预期账户的配置，可能会导致跟单出现意外的问题。
   */
  account_id: string;

  /**
   * 是否启用跟单
   */
  enabled: boolean;

  /**
   * 跟单策略配置
   */
  strategy: ITradeCopierStrategyConfig;

  created_at: string;
  updated_at: string;
}
