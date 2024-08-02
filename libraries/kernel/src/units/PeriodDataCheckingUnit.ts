import { formatTime } from '@yuants/data-model';
import { PromRegistry, Terminal, queryPeriods } from '@yuants/protocol';
import { EMPTY, Subscription, defer, mergeMap, repeat, retry, tap } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';

const MetricPeriodDataCheckingUnitPeriodSelfCheckTotal = PromRegistry.create(
  'gauge',
  'period_data_checking_unit_period_self_check_total',
);

/**
 * 周期数据自检单元
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
    period_in_sec: number;
    start_time_in_us: number;
  }[] = [];

  private subscriptions: Subscription[] = [];

  errorTotal: number = 0;

  onInit() {
    for (const task of this.periodTasks) {
      const { datasource_id, product_id, period_in_sec, start_time_in_us } = task;
      const interval = period_in_sec * 1000;
      let lastCheckedTimestamp = start_time_in_us / 1000;
      let lastCheckedIndex = 0;
      const sub = defer(() =>
        queryPeriods(this.terminal, {
          datasource_id,
          product_id,
          period_in_sec,
          start_time_in_us: lastCheckedTimestamp * 1000,
          end_time_in_us: Date.now() * 1000,
        }),
      )
        .pipe(
          tap({
            subscribe: () => {
              this.kernel.log?.(
                formatTime(Date.now()),
                `DataChecking Start`,
                datasource_id,
                product_id,
                period_in_sec,
                `Last Checked: ${formatTime(lastCheckedTimestamp)} at Series[${lastCheckedIndex}]`,
              );
            },
            finalize: () => {
              this.kernel.log?.(
                formatTime(Date.now()),
                `DataChecking Finish`,
                datasource_id,
                product_id,
                period_in_sec,
              );
            },
          }),
          mergeMap((expected) => {
            const key = [datasource_id, product_id, period_in_sec].join();
            const actual = this.periodDataUnit.data[key];
            // NOTE: expected 可能因为尚未入库的原因，短于 actual
            // NOTE: 给 expected 按照 timestamp_in_us 排序
            expected.sort((a, b) => a.timestamp_in_us - b.timestamp_in_us);
            this.kernel.log?.(
              formatTime(Date.now()),
              `DataChecking`,
              `预期数据的最后一根K线: ${formatTime(expected[expected.length - 1]?.timestamp_in_us / 1000)}`,
            );
            let successTotal = 0;
            let errorTotal = 0;
            for (
              let idx = 0;
              idx < expected.length - 1; // NOTE: 不检查最后一根K线，因为最新的 K线可能尚未稳定
              idx++
            ) {
              const actualPeriod = actual[lastCheckedIndex + idx];
              const expectedPeriod = expected[idx];
              if (
                !(
                  actualPeriod &&
                  expectedPeriod &&
                  actualPeriod.timestamp_in_us === expectedPeriod.timestamp_in_us &&
                  actualPeriod.open === expectedPeriod.open &&
                  actualPeriod.high === expectedPeriod.high &&
                  actualPeriod.low === expectedPeriod.low &&
                  actualPeriod.close === expectedPeriod.close &&
                  actualPeriod.volume === expectedPeriod.volume
                )
              ) {
                console.error(
                  formatTime(Date.now()),
                  `DataChecking Failed`,
                  datasource_id,
                  product_id,
                  period_in_sec,
                  idx,
                  expectedPeriod,
                  actualPeriod,
                );
                errorTotal++;
              } else {
                successTotal++;
              }
            }

            if (errorTotal === 0) {
              // No Error, step lastChecked forward.
              // ISSUE: -CHECK_COUNT because periods may be overlapped
              const CHECK_COUNT = 10;
              if (expected.length >= CHECK_COUNT) {
                const nextTimestampInUs = expected[expected.length - CHECK_COUNT].timestamp_in_us;
                const nextIdx = actual.findIndex((x) => x.timestamp_in_us === nextTimestampInUs);
                // NOTE: nextIdx !== -1, because checking is passed, so the period must be found.
                lastCheckedTimestamp = nextTimestampInUs / 1000;
                lastCheckedIndex = nextIdx;
              }
            }

            this.errorTotal += errorTotal;
            MetricPeriodDataCheckingUnitPeriodSelfCheckTotal.set(errorTotal, {
              kernel_id: this.kernel.id,
              status: 'error',
              datasource_id,
              product_id,
              period_in_sec,
            });
            MetricPeriodDataCheckingUnitPeriodSelfCheckTotal.set(successTotal, {
              kernel_id: this.kernel.id,
              status: 'success',
              datasource_id,
              product_id,
              period_in_sec,
            });
            return EMPTY;
          }),

          retry({ delay: interval }),
          repeat({
            delay: interval,
          }),
        )
        .subscribe();
      this.subscriptions.push(sub);
    }
  }
  onDispose(): void | Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
