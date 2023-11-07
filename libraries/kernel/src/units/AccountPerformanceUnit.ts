import { IAccountInfo, PositionVariant } from '@yuants/protocol';
import { Kernel } from '../kernel';
import { AccountSimulatorUnit } from './AccountSimulatorUnit';
import { BasicUnit } from './BasicUnit';

/**
 * 账户性能统计
 * @public
 */
export interface IAccountPerformance {
  account_id: string;
  timestamp: number;
  first_timestamp: number;

  currency: string;

  /** 期末净值 */
  equity: number;
  /** 净值基数 = min(equity, balance) */
  equity_base: number;
  /** 期初 */
  opening_equity: number;
  /** 最大净值基数 = max(equity_base) */
  max_equity_base: number;
  /** 最大净值 = max(equity) */
  max_equity: number;
  /** 净值回撤 drawdown = max_equity_base - equity */
  drawdown: number;
  /** 最大回撤 = max(drawdown) */
  max_drawdown: number;
  /** 收益回撤比 = equity / max_drawdown */
  profit_drawdown_ratio: number;
  /** 维持保证金 = used + drawdown */
  maintenance_margin: number;
  /** 维持保证金在时间上的积分 */
  integral_maintenance_margin: number;
  /** 资金占用率 */
  capital_occupancy_rate: number;
  /** 最大维持保证金 = max(maintenance_margin) */
  max_maintenance_margin: number;
  /** 最大使用保证金 = max(used) */
  max_used_margin: number;
  /** 第一次交易时间戳 */
  first_order_timestamp: number;
  /** 跨越天数 = (Date.now() - first_order_timestamp) / 86400_000 */
  total_days: number;
  /** 平均每日收益 = equity / total_days */
  avg_profit_per_day: number;
  /** 资本回报期 = max_maintenance_margin / avg_profit_per_day */
  payback_period_in_days: number;
  /** 日收益率 = 1 / payback_period_in_days = avg_profit_per_day / max_maintenance_margin */
  daily_return_ratio: number;
  /** 周收益率 = 7 * daily_return_ratio */
  weekly_return_ratio: number;
  /** 年收益率 = 365 * daily_return_ratio */
  yearly_return_ratio: number;

  _daily_return_ratio_list: number[];
  _weekly_return_ratio_list: number[];
  _weekly_equity: number[];

  /** 今日净值的起点 */
  today_first_equity: number;
  /** 今日收益 */
  today_profit: number;
  /** 每日收益的期望 */
  expect_everyday_profit: number;
  /** 每日收益的平方的期望 */
  expect_squared_everyday_profit: number;
  /** 每日收益的波动率 */
  volatility_everyday_profit: number;
  /** 日尺度的夏普比率 */
  daily_sharpe_ratio: number;
  /** 下行天数 */
  total_downside_days: number;
  /** 每日下行收益的期望 */
  expect_everyday_downside_profit: number;
  /** 每日下行收益的平方的期望 */
  expect_squared_everyday_downside_profit: number;
  /** 每日下行收益的波动率 */
  volatility_everyday_downside_profit: number;
  /** 日尺度的索提诺比率 */
  daily_sortino_ratio: number;

  /** 总周数 */
  total_weeks: number;
  /** 本周初始净值 */
  this_week_first_equity: number;
  /** 本周收益 */
  this_week_profit: number;
  /** 每周收益的期望 */
  expect_everyweek_profit: number;
  /** 每周收益的平方的期望 */
  expect_squared_everyweek_profit: number;
  /** 每周收益的波动率 */
  volatility_everyweek_profit: number;
  /** 周尺度的夏普比率 */
  weekly_sharpe_ratio: number;
  /** 下行周数 */
  total_downside_weeks: number;
  /** 每周下行收益的期望 */
  expect_everyweek_downside_profit: number;
  /** 每周下行收益的平方的期望 */
  expect_squared_everyweek_downside_profit: number;
  /** 每周下行收益的波动率 */
  volatility_everyweek_downside_profit: number;
  /** 周尺度的索提诺比率 */
  weekly_sortino_ratio: number;

  _position_performance_list: Record<string, IAccountPositionPerformance>;
  _history_position_performance: IAccountPositionPerformance[];
  _history_weekly_equity: Array<{ high: number; low: number }>;
  _weekly_first_timestamp: number[];
  // _alive_position_id_list: string[];
  /** 总持仓次数 */
  total_positions: number;
  /** 持仓最小盈亏 P25 */
  min_profit_p25: number;
  /** 持仓最小盈亏 P75 */
  min_profit_p75: number;
  /** 持仓最小盈亏 四分位距 */
  min_profit_interquartile_range: number;
  /** 持仓最小盈亏的离群下边界 */
  min_profit_lower_fence: number;
  /** 基于持仓最小盈亏的下边界离群次数 */
  min_profit_lower_fence_out_count: number;
}

interface IAccountPositionPerformance {
  account_id: string;
  position_id: string;
  product_id: string;
  variant: PositionVariant;

  profit: number;
  volume: number;
  max_profit: number;
  min_profit: number;
  max_volume: number;
}

/**
 * 账户性能审计单元
 * @public
 */
export class AccountPerformanceUnit extends BasicUnit {
  constructor(public kernel: Kernel, public accountUnit: AccountSimulatorUnit) {
    super(kernel);
  }

  performance: IAccountPerformance = AccountPerformanceUnit.makeInitAccountPerformance(
    this.accountUnit.accountInfo.account_id,
  );

  onEvent(): void | Promise<void> {
    this.performance = AccountPerformanceUnit.reduceAccountPerformance(
      this.performance,
      this.accountUnit.accountInfo,
    );
  }

  /**
   * 用于初始化账户性能的函数
   */
  static makeInitAccountPerformance = (account_id: string): IAccountPerformance => ({
    account_id,
    currency: '',
    timestamp: NaN,
    first_timestamp: NaN,
    equity: NaN,
    equity_base: NaN,
    opening_equity: NaN,
    max_equity_base: NaN,
    max_equity: NaN,
    drawdown: NaN,
    max_drawdown: NaN,
    profit_drawdown_ratio: NaN,
    maintenance_margin: NaN,
    integral_maintenance_margin: NaN,
    capital_occupancy_rate: NaN,
    max_maintenance_margin: NaN,
    max_used_margin: NaN,
    first_order_timestamp: NaN,
    total_days: NaN,
    avg_profit_per_day: NaN,
    payback_period_in_days: NaN,
    daily_return_ratio: NaN,
    weekly_return_ratio: NaN,
    yearly_return_ratio: NaN,
    _daily_return_ratio_list: [],
    _weekly_return_ratio_list: [],
    _weekly_equity: [],
    _history_weekly_equity: [],
    _weekly_first_timestamp: [],
    today_first_equity: NaN,
    today_profit: NaN,
    expect_everyday_profit: NaN,
    expect_squared_everyday_profit: NaN,
    volatility_everyday_profit: NaN,
    daily_sharpe_ratio: NaN,
    total_downside_days: NaN,
    expect_everyday_downside_profit: NaN,
    expect_squared_everyday_downside_profit: NaN,
    volatility_everyday_downside_profit: NaN,
    daily_sortino_ratio: NaN,
    total_downside_weeks: NaN,
    expect_everyweek_downside_profit: NaN,
    expect_squared_everyweek_downside_profit: NaN,
    volatility_everyweek_downside_profit: NaN,
    weekly_sortino_ratio: NaN,
    total_weeks: NaN,
    this_week_first_equity: NaN,
    this_week_profit: NaN,
    expect_everyweek_profit: NaN,
    expect_squared_everyweek_profit: NaN,
    volatility_everyweek_profit: NaN,
    weekly_sharpe_ratio: NaN,

    _position_performance_list: {},
    _history_position_performance: [],
    total_positions: NaN,
    min_profit_lower_fence: NaN,
    min_profit_interquartile_range: NaN,
    min_profit_p25: NaN,
    min_profit_p75: NaN,
    min_profit_lower_fence_out_count: NaN,
  });

  /**
   * 用于计算账户性能的 Reducer 函数
   */
  static reduceAccountPerformance = (acc: IAccountPerformance, cur: IAccountInfo): IAccountPerformance => {
    const timestamp = cur.timestamp_in_us / 1000;
    const first_timestamp = Number.isNaN(acc.first_timestamp) ? timestamp : acc.first_timestamp;
    const equity = cur.money.equity;
    const balance = cur.money.balance;
    const equity_base = Math.min(equity, balance);
    const opening_equity = Number.isNaN(acc.opening_equity) ? equity : acc.opening_equity;
    const max_equity_base = Number.isNaN(acc.max_equity_base)
      ? equity_base
      : Math.max(acc.max_equity_base, equity_base);
    const max_equity = Number.isNaN(acc.max_equity) ? equity : Math.max(acc.max_equity, equity);
    const drawdown = max_equity_base - equity;
    const max_drawdown = Number.isNaN(acc.max_drawdown) ? drawdown : Math.max(acc.max_drawdown, drawdown);
    const profit_drawdown_ratio = (equity - opening_equity) / max_drawdown;
    const maintenance_margin = cur.money.used + drawdown;
    const integral_maintenance_margin =
      (Number.isNaN(acc.integral_maintenance_margin) ? 0 : acc.integral_maintenance_margin) +
      ((timestamp - acc.timestamp) * (maintenance_margin + acc.maintenance_margin)) / 2; // 积分计算
    const max_maintenance_margin = Number.isNaN(acc.max_maintenance_margin)
      ? maintenance_margin
      : Math.max(acc.max_maintenance_margin, maintenance_margin);
    const capital_occupancy_rate =
      integral_maintenance_margin / max_maintenance_margin / (timestamp - first_timestamp);
    const max_used_margin = Number.isNaN(acc.max_used_margin)
      ? cur.money.used
      : Math.max(acc.max_used_margin, cur.money.used);
    const first_order_timestamp =
      Number.isNaN(acc.first_order_timestamp) && cur.money.used !== 0
        ? cur.timestamp_in_us / 1000
        : acc.first_order_timestamp;

    // 基于日的统计
    const isSameDay = ~~(acc.timestamp / 86400_000) === ~~(timestamp / 86400_000); // ISSUE: 时区问题
    const total_days = isSameDay ? acc.total_days : (acc.total_days || 0) + 1;
    const today_first_equity = isSameDay ? acc.today_first_equity : equity;
    const today_profit = equity - acc.today_first_equity;
    const _daily_return_ratio_list = isSameDay
      ? acc._daily_return_ratio_list
      : [...acc._daily_return_ratio_list, Number.isNaN(today_profit) ? 0 : today_profit];

    const expect_everyday_profit = isSameDay
      ? acc.expect_everyday_profit
      : Number.isNaN(acc.expect_everyday_profit)
      ? acc.today_profit
      : (acc.expect_everyday_profit * (total_days - 1)) / total_days + today_profit / total_days;
    const expect_squared_everyday_profit = isSameDay
      ? acc.expect_squared_everyday_profit
      : Number.isNaN(acc.expect_squared_everyday_profit)
      ? today_profit ** 2
      : (acc.expect_squared_everyday_profit * (total_days - 1)) / total_days + today_profit ** 2 / total_days;
    const volatility_everyday_profit = Math.sqrt(
      expect_squared_everyday_profit - expect_everyday_profit ** 2,
    );
    const daily_sharpe_ratio = expect_everyday_profit / volatility_everyday_profit;
    const total_downside_days =
      !isSameDay && acc.today_profit < 0 ? (acc.total_downside_days || 0) + 1 : acc.total_downside_days;
    const expect_everyday_downside_profit =
      !isSameDay && acc.today_profit < 0
        ? Number.isNaN(acc.expect_everyday_downside_profit)
          ? acc.today_profit
          : (acc.expect_everyday_downside_profit * (total_downside_days - 1)) / total_downside_days +
            acc.today_profit / total_downside_days
        : acc.expect_everyday_downside_profit;
    const expect_squared_everyday_downside_profit =
      !isSameDay && acc.today_profit < 0
        ? Number.isNaN(acc.expect_squared_everyday_downside_profit)
          ? acc.today_profit ** 2
          : (acc.expect_squared_everyday_downside_profit * (total_downside_days - 1)) / total_downside_days +
            acc.today_profit ** 2 / total_downside_days
        : acc.expect_squared_everyday_downside_profit;
    const volatility_everyday_downside_profit = Math.sqrt(
      expect_squared_everyday_downside_profit - expect_everyday_downside_profit ** 2,
    );
    const daily_sortino_ratio =
      (expect_everyday_profit / volatility_everyday_downside_profit) *
      Math.sqrt(total_days / total_downside_days);

    // 基于周的统计
    const isSameWeek =
      ~~((~~(acc.timestamp / 86400_000) + 4) / 7) === ~~((~~(timestamp / 86400_000) + 4) / 7); // 以周一为开始
    const total_weeks = isSameWeek ? acc.total_weeks : (acc.total_weeks || 0) + 1;
    const this_week_first_equity = isSameWeek ? acc.this_week_first_equity : equity;
    const this_week_profit = equity - acc.this_week_first_equity;
    const _weekly_return_ratio_list = isSameWeek
      ? acc._weekly_return_ratio_list
      : [...acc._weekly_return_ratio_list, Number.isNaN(this_week_profit) ? 0 : this_week_profit];
    const _weekly_equity = isSameWeek
      ? acc._weekly_equity
      : [...acc._weekly_equity, Number.isNaN(acc.equity) ? 0 : acc.equity];

    const expect_everyweek_profit = isSameWeek
      ? acc.expect_everyweek_profit
      : Number.isNaN(acc.expect_everyweek_profit)
      ? acc.this_week_profit
      : (acc.expect_everyweek_profit * (total_weeks - 1)) / total_weeks + acc.this_week_profit / total_weeks;
    const expect_squared_everyweek_profit = isSameWeek
      ? acc.expect_squared_everyweek_profit
      : Number.isNaN(acc.expect_squared_everyweek_profit)
      ? acc.this_week_profit ** 2
      : (acc.expect_squared_everyweek_profit * (total_weeks - 1)) / total_weeks +
        acc.this_week_profit ** 2 / total_weeks;
    const volatility_everyweek_profit = Math.sqrt(
      expect_squared_everyweek_profit - expect_everyweek_profit ** 2,
    );
    const weekly_sharpe_ratio = expect_everyweek_profit / volatility_everyweek_profit;

    const total_downside_weeks = isSameWeek
      ? acc.total_downside_weeks
      : acc.this_week_profit < 0
      ? (acc.total_downside_weeks || 0) + 1
      : acc.total_downside_weeks;

    const expect_everyweek_downside_profit =
      isSameWeek && !(acc.this_week_profit < 0)
        ? acc.expect_everyweek_downside_profit
        : Number.isNaN(acc.expect_everyweek_downside_profit)
        ? acc.this_week_profit
        : (acc.expect_everyweek_downside_profit * (total_downside_weeks - 1)) / total_downside_weeks +
          acc.this_week_profit / total_downside_weeks;
    const expect_squared_everyweek_downside_profit =
      isSameWeek && !(acc.this_week_profit < 0)
        ? acc.expect_squared_everyweek_downside_profit
        : Number.isNaN(acc.expect_squared_everyweek_downside_profit)
        ? acc.this_week_profit ** 2
        : (acc.expect_squared_everyweek_downside_profit * (total_downside_weeks - 1)) / total_downside_weeks +
          acc.this_week_profit ** 2 / total_downside_weeks;
    const volatility_everyweek_downside_profit = Math.sqrt(
      expect_squared_everyweek_downside_profit - expect_everyweek_downside_profit ** 2,
    );
    const weekly_sortino_ratio =
      (expect_everyweek_profit / volatility_everyweek_downside_profit) *
      (total_weeks / total_downside_weeks) ** 0.5;

    const avg_profit_per_day = (equity - opening_equity) / total_days;
    const payback_period_in_days = max_maintenance_margin / avg_profit_per_day;
    const daily_return_ratio = avg_profit_per_day / max_maintenance_margin;
    const weekly_return_ratio = 7 * daily_return_ratio;
    const yearly_return_ratio = 365 * daily_return_ratio;
    const _position_performance_list: Record<string, IAccountPositionPerformance> = {};
    cur.positions.forEach((pos) => {
      if (pos.volume > 0) {
        // CASE 1: 新增头寸的情况
        if (!acc._position_performance_list[pos.position_id]) {
          _position_performance_list[pos.position_id] = {
            account_id: acc.account_id,
            position_id: pos.position_id,
            product_id: pos.product_id,
            variant: pos.variant,
            profit: pos.floating_profit,
            volume: pos.volume,
            max_profit: pos.floating_profit,
            min_profit: pos.floating_profit,
            max_volume: pos.volume,
          };
        }
        // CASE 2: 修改已有头寸的情况
        else {
          const position_performance = acc._position_performance_list[pos.position_id];
          const profit = pos.floating_profit;
          const volume = pos.volume;
          const max_profit = Math.max(position_performance.max_profit, profit);
          const min_profit = Math.min(position_performance.min_profit, profit);
          const max_volume = Math.max(position_performance.max_volume, volume);

          _position_performance_list[pos.position_id] = {
            account_id: acc.account_id,
            position_id: pos.position_id,
            product_id: pos.product_id,
            variant: pos.variant,
            profit,
            volume,
            max_profit,
            min_profit,
            max_volume,
          };
        }
      }
    });

    let _history_position_performance = acc._history_position_performance;

    for (const position_id in acc._position_performance_list) {
      // CASE 3: 删除已有头寸的情况，要进行头寸的性能结算
      if (!_position_performance_list[position_id]) {
        const positionPerformance = acc._position_performance_list[position_id];

        // ISSUE: 按需拷贝数组，节约内存
        if (acc._history_position_performance === _history_position_performance) {
          _history_position_performance = [..._history_position_performance];
        }

        _history_position_performance.push(positionPerformance);
      }
    }

    const _is_found_new_position_performance =
      acc._history_position_performance !== _history_position_performance;

    if (_is_found_new_position_performance) {
      _history_position_performance.sort((a, b) => a.min_profit - b.min_profit);
    }

    const total_positions = _history_position_performance.length;
    const min_profit_p25 =
      _history_position_performance[Math.floor(total_positions * 0.25)]?.min_profit ?? NaN;
    const min_profit_p75 =
      _history_position_performance[Math.floor(total_positions * 0.75)]?.min_profit ?? NaN;
    const min_profit_interquartile_range = min_profit_p75 - min_profit_p25;
    const min_profit_lower_fence = min_profit_p25 - 3 * min_profit_interquartile_range; // far out
    const min_profit_lower_fence_out_count = _is_found_new_position_performance
      ? _history_position_performance.reduce(
          (acc, cur) => acc + (cur.min_profit < min_profit_lower_fence ? 1 : 0),
          0,
        )
      : acc.min_profit_lower_fence_out_count;

    const _weekly_first_timestamp = isSameWeek
      ? acc._weekly_first_timestamp
      : [...acc._weekly_first_timestamp, timestamp];

    const _history_weekly_equity = isSameWeek
      ? equity >= acc._history_weekly_equity[acc._history_weekly_equity.length - 1].low &&
        equity <= acc._history_weekly_equity[acc._history_weekly_equity.length - 1].high
        ? acc._history_weekly_equity
        : [
            ...acc._history_weekly_equity.slice(0, -1),
            {
              high: Math.max(equity, acc._history_weekly_equity[acc._history_weekly_equity.length - 1].high),
              low: Math.min(equity, acc._history_weekly_equity[acc._history_weekly_equity.length - 1].low),
            },
          ]
      : [...acc._history_weekly_equity, { high: equity, low: equity }];

    return {
      account_id: acc.account_id,
      timestamp,
      first_timestamp,
      currency: cur.money.currency,
      equity,
      equity_base,
      opening_equity,
      max_equity_base,
      max_equity,
      drawdown,
      max_drawdown,
      profit_drawdown_ratio,
      maintenance_margin,
      integral_maintenance_margin,
      capital_occupancy_rate,
      max_maintenance_margin,
      max_used_margin,
      first_order_timestamp,
      total_days,
      today_first_equity,
      today_profit,
      expect_everyday_profit,
      expect_squared_everyday_profit,
      volatility_everyday_profit,
      daily_sharpe_ratio,
      total_downside_days,
      expect_everyday_downside_profit,
      expect_squared_everyday_downside_profit,
      volatility_everyday_downside_profit,
      daily_sortino_ratio,
      total_weeks,
      this_week_first_equity,
      this_week_profit,
      expect_everyweek_profit,
      expect_squared_everyweek_profit,
      volatility_everyweek_profit,
      weekly_sharpe_ratio,
      total_downside_weeks,
      expect_everyweek_downside_profit,
      expect_squared_everyweek_downside_profit,
      volatility_everyweek_downside_profit,
      weekly_sortino_ratio,
      avg_profit_per_day,
      payback_period_in_days,
      daily_return_ratio,
      weekly_return_ratio,
      yearly_return_ratio,
      _daily_return_ratio_list,
      _weekly_return_ratio_list,
      _weekly_equity,
      _position_performance_list,
      _history_position_performance,
      _history_weekly_equity,
      _weekly_first_timestamp,
      min_profit_p25,
      min_profit_p75,
      min_profit_interquartile_range,
      total_positions,
      min_profit_lower_fence,
      min_profit_lower_fence_out_count,
    };
  };

  dump() {
    return {
      performance: this.performance,
    };
  }
  restore(state: any) {
    this.performance = state.performance;
  }
}
