import { IOHLC } from '@yuants/data-ohlc';
import { ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { ProductDataUnit } from './ProductDataUnit';

const mapDurationToCronPattern: Record<string, string> = {
  PT1M: '* * * * *',
  PT5M: '*/5 * * * *',
  PT15M: '*/15 * * * *',
  PT30M: '*/30 * * * *',
  PT1H: '0 * * * *',
  PT4H: '0 */4 * * *',
  P1D: '0 0 * * *',
};

/**
 * 实时周期数据加载单元
 * @public
 */
export class RealtimePeriodLoadingUnit extends BasicUnit {
  constructor(
    public kernel: Kernel,
    public terminal: Terminal,
    public productDataUnit: ProductDataUnit,
    public periodDataUnit: PeriodDataUnit,
  ) {
    super(kernel);
    this.kernel = kernel;
  }
  private mapEventIdToPeriod = new Map<number, IOHLC[]>();

  periodTasks: {
    datasource_id: string;
    product_id: string;
    duration: string;
  }[] = [];

  onEvent(): void | Promise<void> {
    const periods = this.mapEventIdToPeriod.get(this.kernel.currentEventId);
    if (periods) {
      periods.forEach((period) => {
        this.periodDataUnit.updatePeriod(period);
      });

      this.mapEventIdToPeriod.delete(this.kernel.currentEventId);
    }
  }

  private subscriptions: Subscription[] = [];

  async onInit() {
    const tasks = this.periodTasks.map((task): ISeriesCollectingTask => {
      return {
        table_name: 'ohlc',
        series_id: encodePath(task.datasource_id, task.product_id, task.duration),
        cron_pattern: mapDurationToCronPattern[task.duration],
        cron_timezone: 'GMT',
        disabled: false,
        replay_count: 0,
      };
    });

    await requestSQL(
      this.terminal,
      buildInsertManyIntoTableSQL(tasks, 'series_collecting_task', { ignoreConflict: true }),
    );

    // 配置行情查询任务
    for (const task of this.periodTasks) {
      const { datasource_id, product_id, duration } = task;
      const theProduct = this.productDataUnit.getProduct(datasource_id, product_id);

      const channelId = encodePath(datasource_id, product_id, duration);
      // ISSUE: Period[].length >= 2 to ensure overlay
      this.subscriptions.push(
        defer(() => this.terminal.channel.subscribeChannel<IOHLC[]>('Periods', channelId)).subscribe(
          (periods) => {
            if (periods.length < 2) {
              console.warn(
                formatTime(Date.now()),
                `Period feeds too less. channel="${channelId}"`,
                JSON.stringify(periods),
              );
              return;
            }
            const eventId = this.kernel.alloc(Date.now());
            this.mapEventIdToPeriod.set(eventId, periods);
          },
        ),
      );
    }
  }
  onDispose(): void | Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
