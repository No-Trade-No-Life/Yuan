import { IFundEvent, IFundState } from './model';

export const reduceState = (state: IFundState, event: IFundEvent): IFundState => {
  const nextState = structuredClone(state);
  nextState.updated_at = new Date(event.updated_at).getTime();
  nextState.description = event.comment || '';
  nextState.events.push(event);

  if (!nextState.created_at) {
    nextState.created_at = nextState.updated_at;
  }

  // 更新基金 ID
  if (event.account_id) {
    nextState.account_id = event.account_id;
  }

  // 更新总资产
  if (event.fund_equity) {
    nextState.total_assets = event.fund_equity.equity;
  }
  // 投资人订单
  if (event.order) {
    const deposit = event.order.deposit;
    const investor = (nextState.investors[event.order.name] ??= {
      name: event.order.name,
      deposit: 0,
      share: 0,
      tax_threshold: 0,
      tax_rate: 0,
    });
    investor.deposit += deposit;
    investor.tax_threshold += deposit;
    investor.share += deposit / state.summary_derived.unit_price;
    nextState.total_assets += deposit;
  }
  // 更新投资人信息
  if (event.investor) {
    // 更新税率
    if (event.investor.tax_rate) {
      nextState.investors[event.investor.name].tax_rate = event.investor.tax_rate;
    }
  }
  // 结税
  if (event.type === 'taxation') {
    for (const investor of Object.values(nextState.investors)) {
      investor.share = state.investor_derived[investor.name].after_tax_share;
      nextState.total_assets -= state.investor_derived[investor.name].tax;
      investor.tax_threshold = state.investor_derived[investor.name].after_tax_assets;
      nextState.total_taxed += state.investor_derived[investor.name].tax;
    }
  }

  // 计算衍生数据
  {
    nextState.summary_derived.total_share = Object.values(nextState.investors).reduce(
      (acc, cur) => acc + cur.share,
      0,
    );
    nextState.summary_derived.unit_price =
      nextState.summary_derived.total_share === 0
        ? 1
        : nextState.total_assets / nextState.summary_derived.total_share;

    nextState.summary_derived.total_time = nextState.updated_at - nextState.created_at;

    // 投资人衍生数据
    Object.values(nextState.investors).forEach((v) => {
      const share_ratio =
        nextState.summary_derived.total_share !== 0 ? v.share / nextState.summary_derived.total_share : 0;
      const pre_tax_assets = v.share * nextState.summary_derived.unit_price;
      const taxable = pre_tax_assets - v.tax_threshold;
      const tax = Math.max(0, taxable * v.tax_rate);
      const after_tax_assets = pre_tax_assets - tax;
      const after_tax_profit = after_tax_assets - v.deposit;
      // Assert: 税后收益和净入金不可能同时为负数
      const after_tax_profit_rate = after_tax_profit / (v.deposit >= 0 ? v.deposit : after_tax_assets);
      const after_tax_share = after_tax_assets / nextState.summary_derived.unit_price;
      nextState.investor_derived[v.name] = {
        share_ratio,
        taxable,
        tax,
        pre_tax_assets,
        after_tax_assets,
        after_tax_profit,
        after_tax_profit_rate,
        after_tax_share,
      };
    });

    // 总体衍生数据
    nextState.summary_derived.total_deposit = Object.values(nextState.investors).reduce(
      (acc, cur) => acc + cur.deposit,
      0,
    );
    nextState.summary_derived.total_tax = Object.values(nextState.investor_derived).reduce(
      (acc, cur) => acc + cur.tax,
      0,
    );
    nextState.summary_derived.total_profit =
      nextState.total_assets - nextState.summary_derived.total_deposit + nextState.total_taxed;
  }

  return nextState;
};

export const getInitFundState = (): IFundState => ({
  account_id: '',
  created_at: 0,
  updated_at: 0,
  description: '',
  total_assets: 0, // 总资产
  total_taxed: 0,
  summary_derived: {
    total_deposit: 0,
    total_share: 0,
    total_tax: 0,
    unit_price: 1,
    total_time: 0,
    total_profit: 0,
  },
  investors: {},
  investor_derived: {},
  events: [],
});

export const fromFundEvents = (events: IFundEvent[]): IFundState => {
  return events.reduce(reduceState, getInitFundState());
};
