export interface IFundEvent {
  type: string;
  updated_at: string;
  comment?: string;
  /** 设置 Fund 账户 ID */
  account_id?: string;
  /** 更新基金总资产的动作 */
  fund_equity?: {
    equity: number;
  };
  /** 更新投资人信息的动作 */
  order?: {
    name: string;
    /** 净入金 */
    deposit: number;
  };
  investor?: {
    name: string;
    /** 更改税率 */
    tax_rate?: number;
  };
}

/**
 * 基金状态
 *
 * @public
 */
export interface IFundState {
  account_id: string;
  created_at: number;
  updated_at: number;
  description: string; // 描述
  /** 总资产 */
  total_assets: number;
  /** 已征税费 */
  total_taxed: number;
  summary_derived: {
    /** 总入金 */
    total_deposit: number;
    /** 总份额 */
    total_share: number;
    /** 总税费 */
    total_tax: number;
    /** 单位净值 */
    unit_price: number;
    /** 存续时间 */
    total_time: number;
    /** 总收益 */
    total_profit: number;
  };
  investors: Record<string, InvestorMeta>; // 投资人数据
  investor_cashflow: Record<string, InvestorCashFlowItem[]>;
  investor_derived: Record<string, InvestorInfoDerived>;
  events: IFundEvent[];
}

export interface InvestorCashFlowItem {
  updated_at: number;
  deposit: number;
}

export interface InvestorMeta {
  /** 姓名 */
  name: string;
  /** 份额 */
  share: number;
  /** 起征点 */
  tax_threshold: number;
  /** 净入金 */
  deposit: number;
  /** 税率 */
  tax_rate: number;
  /** 创建时间 */
  created_at: number;
}

/**
 * 投资人信息的计算衍生数据
 */
export interface InvestorInfoDerived {
  /** 持有时间 */
  holding_days: number;
  /** 资产在时间上的积分 */
  timed_assets: number;
  /** 税前资产 */
  pre_tax_assets: number;
  /** 应税额 */
  taxable: number;
  /** 税费 */
  tax: number;
  /** 税后资产 */
  after_tax_assets: number;
  /** 税后收益 */
  after_tax_profit: number;
  /** 税后收益率 */
  after_tax_profit_rate: number;
  after_tax_IRR: number;
  /** 税后份额 */
  after_tax_share: number;

  /** 份额占比 */
  share_ratio: number;
}
