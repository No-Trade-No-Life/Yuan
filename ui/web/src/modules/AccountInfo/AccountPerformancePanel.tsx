import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Descriptions, Space, Tooltip } from '@douyinfe/semi-ui';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { WeeklyEquityChart } from '../Chart/WeeklyEquityChart';
import { WeeklyProfitChart } from '../Chart/WeeklyProfitChart';
import { registerPage } from '../Pages';
import { accountPerformance$ } from './model';

registerPage('AccountPerformancePanel', () => {
  const performance = useObservableState(accountPerformance$);

  const data = useMemo(
    () =>
      performance._history_position_performance
        .map((x, idx) => ({
          x: x.min_profit,
          CDF: idx / performance._history_position_performance.length,
        }))
        .map((item, idx, arr) => ({
          ...item,
          PDF:
            idx > 0
              ? arr[idx].x - arr[idx - 1].x > 0
                ? (arr[idx].CDF - arr[idx - 1].CDF) / (arr[idx].x - arr[idx - 1].x)
                : 0
              : 0,
        })),
    [performance],
  );

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Descriptions
        data={[
          { key: '回溯历史', value: `${performance.total_days.toFixed(1)}天` },
          {
            key: (
              <>
                最大维持保证金
                <Tooltip
                  content={`按 1 倍跟随策略所需的最大保证本金，此值越小说明策略所需的本金越少，同等资金可以配置更高的杠杆，从而获得更多的盈利。等于维持保证金的最大值。而维持保证金 = 净值回撤 + 使用保证金。`}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: performance.max_maintenance_margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          { key: '日收益率', value: `${(performance.daily_return_ratio * 100).toFixed(2)}%` },
          { key: '周收益率', value: `${(performance.weekly_return_ratio * 100).toFixed(2)}%` },
          {
            key: (
              <>
                年化收益率
                <Tooltip
                  content={`年化收益率 = 日收益率 * 365。以自然日而非交易日计算。所有收益率的分母都取自 最大维持保证金。`}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: `${(performance.yearly_return_ratio * 100).toFixed(2)}%`,
          },

          {
            key: (
              <>
                收益回撤比
                <Tooltip
                  content={`用于衡量同等风险下的收益能力。等于收益与最大净值回撤的比值。\n <0 表示亏损；0 ~ 1 时表示模型不具备显著的优势；> 2 时模型具有显著的盈利能力。`}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: performance.profit_drawdown_ratio.toFixed(5),
          },
          {
            key: (
              <>
                投资回报期
                <Tooltip content={`投资的本金翻倍(盈利 100%)所需的时间。`}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: `${performance.payback_period_in_days.toFixed(1)}天`,
          },
          {
            key: (
              <>
                资金占用率
                <Tooltip
                  content={`考量资金在时间上的利用率。等于 历史时间段内，维持保证金在时间上的积分 / (最大维持保证金 * 历史时长)。`}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),

            value: performance.capital_occupancy_rate.toLocaleString(undefined, {
              style: 'percent',
              minimumFractionDigits: 2,
            }),
          },
          { key: '保证金货币', value: performance.currency },
        ]}
        row
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>
      <Descriptions
        data={[
          { key: '采样天数', value: performance.total_days },
          {
            key: '期望每日收益',
            value: performance.expect_everyday_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '每日收益波动率',
            value: performance.volatility_everyday_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '日采样夏普比率',
            value: (
              <>
                {performance.daily_sharpe_ratio.toFixed(5)}{' '}
                <Tooltip content={`等效年化: ${(performance.daily_sharpe_ratio * 252 ** 0.5).toFixed(5)}`}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
          },
          {
            key: '下行天数',
            value: performance.total_downside_days,
          },
          {
            key: '日采样索提诺比率',
            value: performance.daily_sortino_ratio.toFixed(5),
          },
        ]}
        row
        size="medium"
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>{' '}
      <Descriptions
        data={[
          { key: '采样周数', value: performance.total_weeks },
          {
            key: '期望每周收益',
            value: performance.expect_everyweek_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '每周收益波动率',
            value: performance.volatility_everyweek_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '周采样夏普比率',
            value: (
              <>
                {performance.weekly_sharpe_ratio.toFixed(5)}{' '}
                <Tooltip content={`等效年化: ${(performance.weekly_sharpe_ratio * 50 ** 0.5).toFixed(5)}`}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
          },
          {
            key: '下行周数',
            value: performance.total_downside_weeks,
          },
          {
            key: '周采样索提诺比率',
            value: performance.weekly_sortino_ratio.toFixed(5),
          },
        ]}
        row
        size="medium"
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>
      <Descriptions
        data={[
          {
            key: '当前净值',
            value: performance.equity.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '最大动态净值',
            value: performance.max_equity.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '当前净值基数',
            value: performance.equity_base.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '最大净值基数',
            value: performance.max_equity_base.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },

          {
            key: '最大使用保证金',
            value: performance.max_used_margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '当前净值回撤',
            value: performance.drawdown.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '最大净值回撤',
            value: performance.max_drawdown.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '平均每日盈利',
            value: performance.avg_profit_per_day.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
        ]}
        row
        size="medium"
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>
      <Descriptions
        data={[
          //
          { key: '持仓次数', value: performance.total_positions },
          {
            key: '持仓平均间隔',
            value: `${(performance.total_days / performance.total_positions).toFixed(1)}天`,
          },
        ]}
        row
        size="medium"
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>
      <Descriptions
        data={[
          //
          {
            key: '持仓最小盈亏 P25',
            value: performance.min_profit_p25.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '持仓最小盈亏 P75',
            value: performance.min_profit_p75.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '持仓最小盈亏 四分位距',
            value: performance.min_profit_interquartile_range.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '持仓最小盈亏的离群下边界',
            value: performance.min_profit_lower_fence.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: '持仓最小盈亏的下边界离群次数',
            value: `${performance.min_profit_lower_fence_out_count} (${(
              (performance.min_profit_lower_fence_out_count / performance.total_positions) *
              100
            ).toFixed(2)}%)`,
          },
        ]}
        row
        size="medium"
        style={{
          boxShadow: 'var(--semi-shadow-elevated)',
          backgroundColor: 'var(--semi-color-bg-2)',
          borderRadius: '4px',
          padding: '10px',
          marginRight: '20px',
          width: '100%',
        }}
      ></Descriptions>
      <WeeklyEquityChart />
      <WeeklyProfitChart />
    </Space>
  );
});
