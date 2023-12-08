import { PromRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { AccountPerformanceHubUnit } from '../AccountPerformanceHubUnit';
import { BasicUnit } from '../BasicUnit';

const MetricMaxEquity = PromRegistry.create(
  'gauge',
  'account_performance_unit_max_equity',
  'account_performance_unit_max_equity account performance unit max equity',
);
const MetricDrawdown = PromRegistry.create(
  'gauge',
  'account_performance_unit_drawdown',
  'account_performance_unit_drawdown account_performance_unit drawdown',
);
const MetricMaxDrawdown = PromRegistry.create(
  'gauge',
  'account_performance_unit_max_drawdown',
  'account_performance_unit_max_drawdown account_performance_unit max drawdown',
);
const MetricProfitDrawdownRatio = PromRegistry.create(
  'gauge',
  'account_performance_unit_profit_drawdown_ratio',
  'account_performance_unit_profit_drawdown_ratio account_performance_unit profit drawdown ratio',
);
const MetricMaintenanceMargin = PromRegistry.create(
  'gauge',
  'account_performance_unit_maintenance_margin',
  'account_performance_unit_maintenance_margin account_performance_unit maintenance margin',
);
const MetricMaxMaintenanceMargin = PromRegistry.create(
  'gauge',
  'account_performance_unit_max_maintenance_margin',
  'account_performance_unit_max_maintenance_margin account_performance_unit max maintenance margin',
);
const MetricFirstOrderTimestamp = PromRegistry.create(
  'gauge',
  'account_performance_unit_first_order_timestamp',
  'account_performance_unit_first_order_timestamp account_performance_unit first order timestamp',
);
const MetricTotalDays = PromRegistry.create(
  'gauge',
  'account_performance_unit_total_days',
  'account_performance_unit_total_days account_performance_unit total days',
);
const MetricAvgProfitPerDay = PromRegistry.create(
  'gauge',
  'account_performance_unit_avg_profit_per_day',
  'account_performance_unit_avg_profit_per_day account_performance_unit avg profit per day',
);
const MetricPaybackPeriodInDays = PromRegistry.create(
  'gauge',
  'account_performance_unit_payback_period_in_days',
  'account_performance_unit_payback_period_in_days account_performance_unit payback period in days',
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
      MetricMaxEquity.set(performance.max_equity, labels);
      MetricDrawdown.set(performance.drawdown, labels);
      MetricMaxDrawdown.set(performance.max_drawdown, labels);
      MetricProfitDrawdownRatio.set(performance.profit_drawdown_ratio, labels);
      MetricMaintenanceMargin.set(performance.maintenance_margin, labels);
      MetricMaxMaintenanceMargin.set(performance.max_maintenance_margin, labels);
      MetricFirstOrderTimestamp.set(performance.first_order_timestamp, labels);
      MetricTotalDays.set(performance.total_days, labels);
      MetricAvgProfitPerDay.set(performance.avg_profit_per_day, labels);
      MetricPaybackPeriodInDays.set(performance.payback_period_in_days, labels);
    }
  }
}
