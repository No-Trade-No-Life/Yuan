import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { BasicUnit } from '../BasicUnit';
import { PeriodDataUnit } from '../PeriodDataUnit';

const MetricPeriodDataUnitPeriodsTotal = GlobalPrometheusRegistry.counter(
  'period_data_unit_period_total',
  'period_data_unit_period_total period data unit periods',
);
/**
 * @public
 */
export class PeriodMetricsUnit extends BasicUnit {
  constructor(public kernel: Kernel, public periodDataUnit: PeriodDataUnit) {
    super(kernel);
  }

  onEvent(): void | Promise<void> {
    for (const periods of Object.values(this.periodDataUnit.data)) {
      if (periods.length > 0) {
        MetricPeriodDataUnitPeriodsTotal.labels({
          kernel_id: this.kernel.id,
          datasource_id: periods[0].datasource_id,
          product_id: periods[0].product_id,
          duration: periods[0].duration,
        }).set(periods.length);
      }
    }
  }
}
