import { encodePath, formatTime, IPeriod } from '@yuants/data-model';
import { ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { defer, Subscription } from 'rxjs';
import { Kernel } from '../kernel';
import { mapDurationToPeriodInSec } from '../utils/mapDurationToPeriodInSec';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { ProductDataUnit } from './ProductDataUnit';

const mapPeriodInSecToCronPattern: Record<string, string> = {
  60: '* * * * *',
  300: '*/5 * * * *',
  900: '*/15 * * * *',
  1800: '*/30 * * * *',
  3600: '0 * * * *',
  14400: '0 */4 * * *',
  86400: '0 0 * * *',
};

interface IPullSourceRelation {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
  /** CronJob 模式: 定义拉取数据的时机 */
  cron_pattern: string;
  /** CronJob 的评估时区 */
  // 对于许多国际品种，使用 EET 时区配合工作日 Cron 比较好
  // 对于国内的品种，使用 CST 时区比较好
  // 例如 "0 * * * 1-5" (EET) 表示 EET 时区的工作日每小时的0分拉取数据。
  cron_timezone: string;
  /** 超时时间 (in ms) */
  timeout: number;
  /** 失败后重试的次数 (默认为 0 - 不重试) */
  retry_times: number;
}

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
  private mapEventIdToPeriod = new Map<number, IPeriod[]>();

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
      const period_in_sec = mapDurationToPeriodInSec(task.duration);

      return {
        table_name: 'ohlc',
        series_id: encodePath(task.datasource_id, task.product_id, task.duration),
        cron_pattern: mapPeriodInSecToCronPattern[period_in_sec],
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
        defer(() => this.terminal.channel.subscribeChannel<IPeriod[]>('Periods', channelId)).subscribe(
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
            this.mapEventIdToPeriod.set(
              eventId,
              periods.map((period) => ({ ...period, spread: period.spread || theProduct?.spread || 0 })),
            );
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
