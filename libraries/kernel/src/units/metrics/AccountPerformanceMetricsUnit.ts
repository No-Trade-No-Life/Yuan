import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { AccountPerformanceHubUnit } from '../AccountPerformanceHubUnit';
import { BasicUnit } from '../BasicUnit';

const MetricMaxEquity = GlobalPrometheusRegistry.gauge('account_performance_unit_max_equity', '');
const MetricDrawdown = GlobalPrometheusRegistry.gauge('account_performance_unit_drawdown', '');
const MetricMaxDrawdown = GlobalPrometheusRegistry.gauge('account_performance_unit_max_drawdown', '');
const MetricProfitDrawdownRatio = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_profit_drawdown_ratio',
  '',
);
const MetricMaintenanceMargin = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_maintenance_margin',
  '',
);
const MetricMaxMaintenanceMargin = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_max_maintenance_margin',
  '',
);
const MetricFirstOrderTimestamp = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_first_order_timestamp',
  '',
);
const MetricTotalDays = GlobalPrometheusRegistry.gauge('account_performance_unit_total_days', '');
const MetricAvgProfitPerDay = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_avg_profit_per_day',
  '',
);
const MetricPaybackPeriodInDays = GlobalPrometheusRegistry.gauge(
  'account_performance_unit_payback_period_in_days',
  '',
);
/**
 * @public
 */
export class AccountPerformanceMetricsUnit extends BasicUnit {
  constructor(public kernel: Kernel, public accountPerformanceUnit: AccountPerformanceHubUnit) {
    super(kernel);
  }

  onEvent(): void | Promise<void> {
    for (const [account_id, performance] of this.accountPerformanceUnit.mapAccountIdToPerformance.entries()) {
      const labels = {
        account_id,
      };
      MetricMaxEquity.labels(labels).set(performance.max_equity);
      MetricDrawdown.labels(labels).set(performance.drawdown);
      MetricMaxDrawdown.labels(labels).set(performance.max_drawdown);
      MetricProfitDrawdownRatio.labels(labels).set(performance.profit_drawdown_ratio);
      MetricMaintenanceMargin.labels(labels).set(performance.maintenance_margin);
      MetricMaxMaintenanceMargin.labels(labels).set(performance.max_maintenance_margin);
      MetricFirstOrderTimestamp.labels(labels).set(performance.first_order_timestamp);
      MetricTotalDays.labels(labels).set(performance.total_days);
      MetricAvgProfitPerDay.labels(labels).set(performance.avg_profit_per_day);
      MetricPaybackPeriodInDays.labels(labels).set(performance.payback_period_in_days);
    }
  }
}
