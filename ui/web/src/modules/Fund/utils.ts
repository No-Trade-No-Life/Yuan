import { IFundEvent, IFundState, InvestorCashFlowItem } from './model';

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
      created_at: nextState.updated_at,
      deposit: 0,
      share: 0,
      tax_threshold: 0,
      tax_rate: 0,
    });
    investor.deposit += deposit;
    investor.tax_threshold += deposit;
    investor.share += deposit / state.summary_derived.unit_price;
    nextState.total_assets += deposit;
    const cashflow = (nextState.investor_cashflow[event.order.name] ??= []);
    cashflow.push({ updated_at: nextState.updated_at, deposit });
  }
  // 更新投资人信息
  if (event.investor) {
    // 更新税率
    if (typeof event.investor.tax_rate === 'number') {
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
      const cashflow = nextState.investor_cashflow[v.name];
      const after_tax_IRR =
        nextState.updated_at - v.created_at > 0
          ? Math.pow(
              1 +
                XIRR(
                  cashflow.concat({
                    updated_at: nextState.updated_at,
                    deposit: -after_tax_assets,
                  }),
                ),
              holding_days / 365,
            ) - 1
          : 0;
      nextState.investor_derived[v.name] = {
        holding_days,
        share_ratio,
        taxable,
        tax,
        pre_tax_assets,
        after_tax_assets,
        after_tax_profit,
        timed_assets,
        after_tax_IRR,
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
  investor_cashflow: {},
  events: [],
});

export const fromFundEvents = (events: IFundEvent[]): IFundState => {
  return events.reduce(reduceState, getInitFundState());
};

const XIRR = function xirr(cashflow: InvestorCashFlowItem[], guess = 0.05) {
  // console.info('XIRR calculation started', cashflow);
  const maxIterations = 100;
  const tolerance = 1e-5;

  let x0 = guess;
  let x1;

  for (let i = 0; i < maxIterations; i++) {
    // console.info(`Iteration ${i}: ${x0}`);
    let fValue = 0;
    let fDerivative = 0;

    for (let j = 0; j < cashflow.length; j++) {
      const t = (cashflow[j].updated_at - cashflow[0].updated_at) / (1000 * 60 * 60 * 24 * 365); // Convert milliseconds to years
      const expTerm = Math.exp(-x0 * t);
      fValue -= cashflow[j].deposit * expTerm;
      fDerivative += cashflow[j].deposit * expTerm * t;
    }

    fValue = fValue / cashflow.length;
    fDerivative = fDerivative / cashflow.length;

    x1 = x0 - fValue / fDerivative;

    if (Math.abs(x1 - x0) < tolerance) {
      return x1;
    }

    x0 = x1;
  }

  throw new Error('XIRR calculation did not converge');
};
