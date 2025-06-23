import { PromRegistry, Terminal } from '@yuants/protocol';
import { Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';

const MetricPeriodDataCheckingUnitPeriodSelfCheckTotal = PromRegistry.create(
  'gauge',
  'period_data_checking_unit_period_self_check_total',
);

/**
 * 周期数据自检单元
 *
 * 定期检查 periodDataUnit 中存储的 OHLC 数据是否与数据库中的数据一致
 *
 * 不检查每个 OHLC 序列的最后一根K线，因为最新的 K线可能尚未稳定
 *
 * @public
 */
export class PeriodDataCheckingUnit extends BasicUnit {
  //
  constructor(public kernel: Kernel, public terminal: Terminal, public periodDataUnit: PeriodDataUnit) {
    super(kernel);
  }

  periodTasks: {
    datasource_id: string;
    product_id: string;
    duration: string;
    start_time_in_us: number;
  }[] = [];

  private subscriptions: Subscription[] = [];

  errorTotal: number = 0;

  onInit() {
    // TODO: 计算需要检查的周期数据的哈希，并且用 SQL 在数据库内计算哈希，直接进行哈希比对，避免传输整个数据
    // 如果有错误，记录错误信息，更新 errorTotal
  }
  onDispose(): void | Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
