import { IFundEvent, IFundState } from './model';

const reduceState = (state: IFundState, event: IFundEvent): IFundState => {
  const nextState = structuredClone(state);
  nextState.updated_at = new Date(event.updated_at).getTime();
  nextState.description = event.comment || '';
  nextState.events.push(event);
  nextState.event = event;

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
    const investor = ensureInvestor(nextState, event.order.name);
    investor.deposit += deposit;
    investor.tax_threshold += deposit;
    investor.share += deposit / state.summary_derived.unit_price;
    nextState.total_assets += deposit;
  }
  // 更新投资人信息
  if (event.investor) {
    // 更新税率
    if (typeof event.investor.tax_rate === 'number') {
      nextState.investors[event.investor.name].tax_rate = event.investor.tax_rate;
    }
    if (typeof event.investor.add_tax_threshold === 'number') {
      const nextTaxThreshold =
        nextState.investors[event.investor.name].tax_threshold + event.investor.add_tax_threshold;
      nextState.investors[event.investor.name].tax_threshold = nextTaxThreshold;
    }
    if (event.investor.referrer) {
      nextState.investors[event.investor.name].referrer = event.investor.referrer;
    }
    if (typeof event.investor.referrer_rebate_rate === 'number') {
      nextState.investors[event.investor.name].referrer_rebate_rate = event.investor.referrer_rebate_rate;
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

  if (event.type === 'taxation/v2') {
    // 特点是，税前税后基金的总资产不变
    let totalTaxShare = 0;

    for (const investor of Object.values(nextState.investors)) {
      const tax = state.investor_derived[investor.name].tax;
      const after_tax_share = state.investor_derived[investor.name].after_tax_share;
      // 作为税费的份额
      const taxShare = investor.share - after_tax_share;
      investor.share -= taxShare;
      investor.tax_threshold = state.investor_derived[investor.name].after_tax_assets;
      investor.taxed += tax;
      // 推荐人分佣
      let tax_account_share = taxShare;
      if (investor.referrer && investor.referrer_rebate_rate && nextState.investors[investor.referrer]) {
        const referrer_rebate_share = taxShare * investor.referrer_rebate_rate;
        const rebate_share_value = referrer_rebate_share * state.summary_derived.unit_price;

        // 获得返佣，同时需要提高其起征点 (相当于返佣也是入金)
        nextState.investors[investor.referrer].share += referrer_rebate_share;
        nextState.investors[investor.referrer].tax_threshold += rebate_share_value;
        nextState.investors[investor.referrer].claimed_referrer_rebate += rebate_share_value;

        tax_account_share = taxShare - referrer_rebate_share;
      }
      totalTaxShare += tax_account_share;
      nextState.total_taxed += tax;
    }

    const taxAccount = ensureInvestor(nextState, '@tax');

    taxAccount.share += totalTaxShare;
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
      const investor = state.investor_derived[v.name];

      const share_ratio =
        nextState.summary_derived.total_share !== 0 ? v.share / nextState.summary_derived.total_share : 0;
      const pre_tax_assets = v.share * nextState.summary_derived.unit_price;
      const taxable = pre_tax_assets - v.tax_threshold;
      const tax = Math.max(0, taxable * v.tax_rate);
      const after_tax_assets = pre_tax_assets - tax;
      const after_tax_profit = after_tax_assets - v.deposit;
      const timed_assets = investor
        ? investor.timed_assets +
          ((after_tax_assets + investor.after_tax_assets) * (nextState.updated_at - state.updated_at)) /
            2 /
            (365 * 86400_000)
        : 0;
      const holding_days = (nextState.updated_at - v.created_at) / 86400_000;
      const avg_assets = (timed_assets / holding_days) * 365;
      const after_tax_profit_rate = after_tax_profit / avg_assets;
      const after_tax_share = after_tax_assets / nextState.summary_derived.unit_price;

      nextState.investor_derived[v.name] = {
        holding_days,
        share_ratio,
        taxable,
        tax,
        pre_tax_assets,
        after_tax_assets,
        after_tax_profit,
        timed_assets,
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

const getInitFundState = (): IFundState => ({
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
  event: null,
});

export const fromFundEvents = (events: IFundEvent[]): IFundState => {
  return events.reduce((acc, cur) => {
    try {
      return reduceState(acc, cur);
    } catch (error) {
      console.error('Error processing event:', cur, error);
      return acc;
    }
  }, getInitFundState());
};

export const scanFundEvents = (events: IFundEvent[]): IFundState[] => {
  const states: IFundState[] = [getInitFundState()];
  events.reduce((acc, cur) => {
    try {
      const next = reduceState(acc, cur);
      states.push(next);
      return next;
    } catch (error) {
      console.error('Error processing event:', cur, error);
      return acc;
    }
  }, states[0]);
  return states;
};

function ensureInvestor(nextState: IFundState, investor_name: string) {
  return (nextState.investors[investor_name] ??= {
    name: investor_name,
    created_at: nextState.updated_at,
    deposit: 0,
    share: 0,
    tax_threshold: 0,
    tax_rate: 0,
    taxed: 0,
    referrer: '',
    referrer_rebate_rate: 0,
    claimed_referrer_rebate: 0,
  });
}
