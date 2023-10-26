import { PromRegistry } from '@yuants/protocol';
import { Kernel } from '../../kernel';
import { BasicUnit } from '../BasicUnit';
import { PeriodDataUnit } from '../PeriodDataUnit';

const MetricPeriodDataUnitPeriodsTotal = PromRegistry.create(
  'counter',
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
        MetricPeriodDataUnitPeriodsTotal.set(periods.length, {
          kernel_id: this.kernel.id,
          datasource_id: periods[0].datasource_id,
          product_id: periods[0].product_id,
          period_in_sec: periods[0].period_in_sec,
        });
      }
    }
  }
}
