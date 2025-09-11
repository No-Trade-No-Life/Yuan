import { IconBeaker, IconInfoCircle, IconTestScoreStroked, IconTick } from '@douyinfe/semi-icons';
import { Card, Descriptions, Space, Tooltip, Typography } from '@douyinfe/semi-ui';
import { SmartOptimization } from '@icon-park/react';
import { IAgentConf } from '@yuants/agent';
import { AccountPerformanceUnit, IAccountPerformance } from '@yuants/kernel';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AccountSelector } from '../../AccountInfo';
import { WeeklyEquityChart } from '../../Chart/WeeklyEquityChart';
import { executeCommand } from '../../CommandCenter';
import { Button } from '../../Interactive';
import i18n from '../../Locale/i18n';
import { IMessageCardProps } from '../model';

export default ({
  replaceMessage,
  send,
  messages,
  payload,
}: IMessageCardProps<{
  agent_conf: IAgentConf;
  account_performance: Record<string, IAccountPerformance>;
}>) => {
  const { t } = useTranslation(['Copilot', 'AccountPerformancePanel']);

  const mapAccountIdToPerformance = payload.account_performance;
  const accountIdOptions = useMemo(() => Object.keys(mapAccountIdToPerformance), [mapAccountIdToPerformance]);
  const [accountId, setAccountId] = useState(accountIdOptions[0] || '');

  const performance: IAccountPerformance | undefined =
    mapAccountIdToPerformance[accountId] || AccountPerformanceUnit.makeInitAccountPerformance(accountId);

  return (
    <Card
      title={
        <Space>
          <IconTestScoreStroked />
          <Typography.Text strong>{t('Copilot:SystemBacktestResult:title')}</Typography.Text>
        </Space>
      }
      style={{ width: '100%', flexShrink: 0 }}
      actions={[
        <Button
          icon={<SmartOptimization />}
          onClick={async () => {
            gtag('event', 'copilot_help_analyze_click');
            replaceMessage([
              {
                type: 'Backtest',
                payload: {
                  language: i18n.language,
                },
              },
            ]);
            send();
          }}
        >
          {t('Copilot:SystemBacktestResult:analyze')}
        </Button>,
        <Button
          icon={<IconBeaker />}
          onClick={async () => {
            gtag('event', 'copilot_help_optimize_params_click');
            replaceMessage([
              {
                type: 'OptimizeParams',
                payload: {
                  language: i18n.language,
                },
              },
            ]);
            send();
          }}
        >
          {t('Copilot:SystemBacktestResult:optimize')}
        </Button>,
        messages.filter((msg) => msg.type === 'SystemBacktestResult').length > 1 ? (
          <Button
            icon={<SmartOptimization />}
            onClick={async () => {
              gtag('event', 'copilot_find_best_model_click');
              replaceMessage([
                {
                  type: 'ModelCompare',
                  payload: {
                    language: i18n.language,
                  },
                },
              ]);
              send();
            }}
          >
            {t('Copilot:SystemBacktestResult:compare')}
          </Button>
        ) : null,
      ]}
    >
      <Space vertical align="start" style={{ width: '100%' }}>
        <Space>
          <AccountSelector value={accountId} onChange={setAccountId} candidates={accountIdOptions} />
          <Button onClick={() => executeCommand('TechnicalChart')}>{t('pages:TechnicalChart')}</Button>
          <Button onClick={() => executeCommand('OrderListPanel')}>{t('pages:OrderListPanel')}</Button>
          <Button onClick={() => executeCommand('RecordTablePanel')}>{t('pages:RecordTablePanel')}</Button>
        </Space>
        <Descriptions
          data={[
            {
              key: t('AccountPerformancePanel:total_days'),
              value: t('AccountPerformancePanel:total_days_value', {
                value: performance.total_days.toFixed(1),
              }),
            },
            {
              key: (
                <>
                  {t('AccountPerformancePanel:max_maintenance_margin')}
                  <Tooltip content={t('AccountPerformancePanel:max_maintenance_margin_description')}>
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),
              value: performance.max_maintenance_margin.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:daily_return_ratio'),
              value: `${(performance.daily_return_ratio * 100).toFixed(2)}%`,
            },
            {
              key: t('AccountPerformancePanel:weekly_return_ratio'),
              value: `${(performance.weekly_return_ratio * 100).toFixed(2)}%`,
            },
            {
              key: (
                <>
                  {t('AccountPerformancePanel:yearly_return_ratio')}
                  <Tooltip content={t('AccountPerformancePanel:yearly_return_ratio_description')}>
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),
              value: `${(performance.yearly_return_ratio * 100).toFixed(2)}%`,
            },

            {
              key: (
                <>
                  {t('AccountPerformancePanel:profit_drawdown_ratio')}
                  <Tooltip
                    content={
                      <Trans i18nKey="AccountPerformancePanel:profit_drawdown_ratio_description" t={t} />
                    }
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
                  {t('AccountPerformancePanel:payback_period_in_days')}
                  <Tooltip content={t('AccountPerformancePanel:payback_period_in_days_description')}>
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),
              value: `${performance.payback_period_in_days.toFixed(1)}`,
            },
            {
              key: (
                <>
                  {t('AccountPerformancePanel:capital_occupancy_rate')}
                  <Tooltip content={t('AccountPerformancePanel:capital_occupancy_rate_description')}>
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),

              value: performance.capital_occupancy_rate.toLocaleString(undefined, {
                style: 'percent',
                minimumFractionDigits: 2,
              }),
            },
            { key: t('AccountPerformancePanel:currency'), value: performance.currency },
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
            { key: t('AccountPerformancePanel:samples_in_day'), value: performance.total_days },
            {
              key: t('AccountPerformancePanel:expect_everyday_profit'),
              value: performance.expect_everyday_profit.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:volatility_everyday_profit'),
              value: performance.volatility_everyday_profit.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:daily_sharpe_ratio'),
              value: (
                <>
                  {performance.daily_sharpe_ratio.toFixed(5)}{' '}
                  <Tooltip
                    content={t('AccountPerformancePanel:daily_sharpe_ratio_description', {
                      value: (performance.daily_sharpe_ratio * 252 ** 0.5).toFixed(5),
                    })}
                  >
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),
            },
            {
              key: t('AccountPerformancePanel:total_downside_days'),
              value: performance.total_downside_days,
            },
            {
              key: t('AccountPerformancePanel:daily_sortino_ratio'),
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
            { key: t('AccountPerformancePanel:total_weeks'), value: performance.total_weeks },
            {
              key: t('AccountPerformancePanel:expect_everyweek_profit'),
              value: performance.expect_everyweek_profit.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:volatility_everyweek_profit'),
              value: performance.volatility_everyweek_profit.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:weekly_sharpe_ratio'),
              value: (
                <>
                  {performance.weekly_sharpe_ratio.toFixed(5)}{' '}
                  <Tooltip
                    content={t('AccountPerformancePanel:weekly_sharpe_ratio_description', {
                      value: performance.weekly_sharpe_ratio * 50 ** 0.5,
                    })}
                  >
                    <IconInfoCircle />
                  </Tooltip>
                </>
              ),
            },
            {
              key: t('AccountPerformancePanel:total_downside_weeks'),
              value: performance.total_downside_weeks,
            },
            {
              key: t('AccountPerformancePanel:weekly_sortino_ratio'),
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
              key: t('AccountPerformancePanel:equity'),
              value: performance.equity.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:max_equity'),
              value: performance.max_equity.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:equity_base'),
              value: performance.equity_base.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:max_equity_base'),
              value: performance.max_equity_base.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },

            {
              key: t('AccountPerformancePanel:max_used_margin'),
              value: performance.max_used_margin.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:drawdown'),
              value: performance.drawdown.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:max_drawdown'),
              value: performance.max_drawdown.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:avg_profit_per_day'),
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
            { key: t('AccountPerformancePanel:total_positions'), value: performance.total_positions },
            {
              key: t('AccountPerformancePanel:average_position_interval'),
              value: t('AccountPerformancePanel:average_position_interval_value', {
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
              key: t('AccountPerformancePanel:min_profit_p25'),
              value: performance.min_profit_p25.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:min_profit_p75'),
              value: performance.min_profit_p75.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:min_profit_interquartile_range'),
              value: performance.min_profit_interquartile_range.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:min_profit_lower_fence'),
              value: performance.min_profit_lower_fence.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              }),
            },
            {
              key: t('AccountPerformancePanel:min_profit_lower_fence_out_count'),
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
        <WeeklyEquityChart accountPerformance={performance} />
      </Space>
    </Card>
  );
};
