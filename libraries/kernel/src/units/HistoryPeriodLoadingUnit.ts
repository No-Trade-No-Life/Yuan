import { IPeriod, encodePath, formatTime } from '@yuants/data-model';
import { IOHLC } from '@yuants/data-ohlc';
import { Terminal } from '@yuants/protocol';
import { escape, requestSQL } from '@yuants/sql';
import { defer, lastValueFrom, map, retry, tap } from 'rxjs';
import { Kernel } from '../kernel';
import { mapDurationToPeriodInSec } from '../utils/mapDurationToPeriodInSec';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { ProductDataUnit } from './ProductDataUnit';

/**
 * 历史数据加载单元
 * @public
 */
export class HistoryPeriodLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public terminal: Terminal,
    public productDataUnit: ProductDataUnit,
    public periodDataUnit: PeriodDataUnit,
  ) {
    super(kernel);
  }
  private mapEventIdToPeriod = new Map<number, IPeriod>();

  periodTasks: {
    datasource_id: string;
    product_id: string;
    duration: string;
    start_time_in_us: number;
    end_time_in_us: number;
  }[] = [];

  async onInit() {
    this.kernel.log?.(`${formatTime(Date.now())} 正在加载历史行情数据: 共 ${this.periodTasks.length} 个任务`);
    for (const task of this.periodTasks) {
      const { datasource_id, product_id, duration } = task;
      const period_in_sec = mapDurationToPeriodInSec(duration);
      this.kernel.log?.(
        `${formatTime(Date.now())} 正在加载 "${task.datasource_id}" / "${task.product_id}" / "${
          task.duration
        }" [${formatTime(task.start_time_in_us / 1000)}, ${formatTime(task.end_time_in_us / 1000)})`,
      );
      const theProduct = this.productDataUnit.getProduct(datasource_id, product_id);
      await lastValueFrom(
        defer(() =>
          requestSQL<IOHLC[]>(
            this.terminal,
            `select * from ohlc where series_id=${escape(
              encodePath(task.datasource_id, task.product_id, task.duration),
            )} and created_at >= ${escape(
              formatTime(task.start_time_in_us / 1000),
            )} and created_at < ${escape(formatTime(task.end_time_in_us / 1000))}
            order by created_at`,
          ),
        ).pipe(
          tap((x) => {
            this.kernel.log?.(
              `${formatTime(Date.now())} 加载完毕 "${task.datasource_id}" / "${task.product_id}" / "${
                task.duration
              }" [${formatTime(task.start_time_in_us / 1000)}, ${formatTime(
                task.end_time_in_us / 1000,
              )}) 共 ${x.length} 条数据`,
            );
          }),
          retry({ count: 3 }),
          map((periods) => {
            periods.forEach((period, idx) => {
              // 推入 Period 数据
              // ISSUE: 将开盘时的K线也推入队列，产生一个模拟的事件，可以提早确认上一根K线的收盘
              const openEventId = this.kernel.alloc(new Date(period.created_at).getTime());
              this.mapEventIdToPeriod.set(openEventId, {
                high: +period.open,
                low: +period.open,
                close: +period.open,
                open: +period.open,
                volume: +period.volume,
                spread: 0,
                datasource_id: period.datasource_id,
                product_id: period.product_id,
                period_in_sec: period_in_sec,
                timestamp_in_us: new Date(period.created_at).getTime() * 1000,
              });
              // ISSUE: 一般来说，K线的收盘时间戳是开盘时间戳 + 周期，但是在历史数据中，K线的收盘时间戳可能会比开盘时间戳 + 周期要早
              const inferred_close_timestamp = Math.min(
                new Date(period.closed_at).getTime() - 1,
                (periods[idx + 1] ? new Date(periods[idx + 1].created_at).getTime() : Infinity) - 1,
                Date.now(),
              );
              const closeEventId = this.kernel.alloc(inferred_close_timestamp);
              this.mapEventIdToPeriod.set(closeEventId, {
                datasource_id: period.datasource_id,
                product_id: period.product_id,
                period_in_sec: period_in_sec,
                timestamp_in_us: new Date(period.created_at).getTime() * 1000,
                open: +period.open,
                high: +period.high,
                low: +period.low,
                close: +period.close,
                volume: +period.volume,
              });
            });
            return periods;
          }),
        ),
      );
    }
  }

  onEvent(): void | Promise<void> {
    const period = this.mapEventIdToPeriod.get(this.kernel.currentEventId);
    if (period) {
      this.periodDataUnit.updatePeriod(period);
      this.mapEventIdToPeriod.delete(this.kernel.currentEventId);
    }
  }

  dump() {
    return {
      periodTasks: this.periodTasks,
      mapEventIdToPeriod: Object.fromEntries(this.mapEventIdToPeriod.entries()),
    };
  }

  restore(state: any): void {
    this.periodTasks = this.periodTasks;
    this.mapEventIdToPeriod = new Map(
      Object.entries(state.mapEventIdToPeriod).map(([k, v]: [string, any]): [number, IPeriod] => [
        Number(k),
        v,
      ]),
    );
  }
}
