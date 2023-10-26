import { IconInfoCircle } from '@douyinfe/semi-icons';
import { Descriptions, Select, Space, Tooltip } from '@douyinfe/semi-ui';
import { AccountPerformanceUnit, IAccountPerformance } from '@yuants/kernel';
import { useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { WeeklyEquityChart } from '../Chart/WeeklyEquityChart';
import { registerPage } from '../Pages';
import { accountPerformance$ } from './model';

registerPage('AccountPerformancePanel', () => {
  const [t] = useTranslation('AccountPerformancePanel');

  const mapAccountIdToPerformance = useObservableState(accountPerformance$);
  const accountIdOptions = Object.keys(mapAccountIdToPerformance);
  const [accountId, setAccountId] = useState(accountIdOptions[0] || '');
  const performance: IAccountPerformance | undefined =
    mapAccountIdToPerformance[accountId] || AccountPerformanceUnit.makeInitAccountPerformance(accountId);

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Select
        value={accountId}
        onChange={(v) => {
          setAccountId(v as string);
        }}
        optionList={accountIdOptions.map((v) => ({ label: v, value: v }))}
      ></Select>
      <Descriptions
        data={[
          {
            key: t('total_days'),
            value: t('total_days_value', { value: performance.total_days.toFixed(1) }),
          },
          {
            key: (
              <>
                {t('max_maintenance_margin')}
                <Tooltip content={t('max_maintenance_margin_description')}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: performance.max_maintenance_margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          { key: t('daily_return_ratio'), value: `${(performance.daily_return_ratio * 100).toFixed(2)}%` },
          { key: t('weekly_return_ratio'), value: `${(performance.weekly_return_ratio * 100).toFixed(2)}%` },
          {
            key: (
              <>
                {t('yearly_return_ratio')}
                <Tooltip content={t('yearly_return_ratio_description')}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: `${(performance.yearly_return_ratio * 100).toFixed(2)}%`,
          },

          {
            key: (
              <>
                {t('profit_drawdown_ratio')}
                <Tooltip content={<Trans i18nKey="profit_drawdown_ratio_description" t={t} />}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: performance.profit_drawdown_ratio.toFixed(5),
          },
          {
            key: (
              <>
                {t('payback_period_in_days')}
                <Tooltip content={t('payback_period_in_days_description')}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
            value: `${performance.payback_period_in_days.toFixed(1)}天`,
          },
          {
            key: (
              <>
                {t('capital_occupancy_rate')}
                <Tooltip content={t('capital_occupancy_rate_description')}>
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),

            value: performance.capital_occupancy_rate.toLocaleString(undefined, {
              style: 'percent',
              minimumFractionDigits: 2,
            }),
          },
          { key: t('currency'), value: performance.currency },
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
          { key: t('samples_in_day'), value: performance.total_days },
          {
            key: t('expect_everyday_profit'),
            value: performance.expect_everyday_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('volatility_everyday_profit'),
            value: performance.volatility_everyday_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('daily_sharpe_ratio'),
            value: (
              <>
                {performance.daily_sharpe_ratio.toFixed(5)}{' '}
                <Tooltip
                  content={t('daily_sharpe_ratio_description', {
                    value: (performance.daily_sharpe_ratio * 252 ** 0.5).toFixed(5),
                  })}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
          },
          {
            key: t('total_downside_days'),
            value: performance.total_downside_days,
          },
          {
            key: t('daily_sortino_ratio'),
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
          { key: t('total_weeks'), value: performance.total_weeks },
          {
            key: t('expect_everyweek_profit'),
            value: performance.expect_everyweek_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('volatility_everyweek_profit'),
            value: performance.volatility_everyweek_profit.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('weekly_sharpe_ratio'),
            value: (
              <>
                {performance.weekly_sharpe_ratio.toFixed(5)}{' '}
                <Tooltip
                  content={t('weekly_sharpe_ratio_description', {
                    value: performance.weekly_sharpe_ratio * 50 ** 0.5,
                  })}
                >
                  <IconInfoCircle />
                </Tooltip>
              </>
            ),
          },
          {
            key: t('total_downside_weeks'),
            value: performance.total_downside_weeks,
          },
          {
            key: t('weekly_sortino_ratio'),
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
            key: t('equity'),
            value: performance.equity.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('max_equity'),
            value: performance.max_equity.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('equity_base'),
            value: performance.equity_base.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('max_equity_base'),
            value: performance.max_equity_base.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },

          {
            key: t('max_used_margin'),
            value: performance.max_used_margin.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('drawdown'),
            value: performance.drawdown.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('max_drawdown'),
            value: performance.max_drawdown.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('avg_profit_per_day'),
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
          { key: t('total_positions'), value: performance.total_positions },
          {
            key: t('average_position_interval'),
            value: t('average_position_interval_value', {
              value: (performance.total_days / performance.total_positions).toFixed(1),
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
          {
            key: t('min_profit_p25'),
            value: performance.min_profit_p25.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('min_profit_p75'),
            value: performance.min_profit_p75.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('min_profit_interquartile_range'),
            value: performance.min_profit_interquartile_range.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('min_profit_lower_fence'),
            value: performance.min_profit_lower_fence.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            }),
          },
          {
            key: t('min_profit_lower_fence_out_count'),
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
      <WeeklyEquityChart accountId={accountId} />
    </Space>
  );
});
