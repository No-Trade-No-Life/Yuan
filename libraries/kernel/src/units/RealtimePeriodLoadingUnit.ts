import { encodePath, formatTime } from '@yuants/data-model';
import { IPeriod, Terminal } from '@yuants/protocol';
import {
  Subscription,
  defer,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  map,
  mergeMap,
  retry,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { Kernel } from '../kernel';
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
    period_in_sec: number;
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
    // ISSUE: period_stream 依赖订阅关系的存在性，因此要先添加订阅关系
    defer(() => this.terminal.queryDataRecords<IPullSourceRelation>({ type: 'pull_source_relation' }))
      .pipe(
        map((v) => v.origin),
        toArray(),
        mergeMap((relations) =>
          from(this.periodTasks).pipe(
            filter(
              (task) =>
                relations.find(
                  (v) =>
                    v.datasource_id === task.datasource_id &&
                    v.product_id === task.product_id &&
                    v.period_in_sec === task.period_in_sec,
                ) === undefined,
            ),
          ),
        ),
        map((task) => ({
          datasource_id: task.datasource_id,
          product_id: task.product_id,
          period_in_sec: task.period_in_sec,
          cron_pattern: mapPeriodInSecToCronPattern[task.period_in_sec],
          cron_timezone: 'GMT',
          timeout: ~~((task.period_in_sec * 1000) / 3),
          retry_times: 3,
        })),
        map((v) => ({
          id: [v.datasource_id, v.product_id, v.period_in_sec].join('\n'),
          type: 'pull_source_relation',
          created_at: Date.now(),
          frozen_at: null,
          updated_at: Date.now(),
          tags: {},
          origin: v,
        })),
        tap((task) => {
          console.info(formatTime(Date.now()), '添加 pull source relation', JSON.stringify(task));
        }),
        toArray(),
        tap((v) => {
          console.info(formatTime(Date.now()), '更新 pull source relation', JSON.stringify(v));
        }),
        delayWhen((v) => this.terminal.updateDataRecords(v)),
        retry({ delay: 1000, count: 5 }),
      )
      .subscribe();

    // 配置行情查询任务
    for (const task of this.periodTasks) {
      const { datasource_id, product_id, period_in_sec } = task;
      const theProduct = this.productDataUnit.getProduct(datasource_id, product_id);

      const channelId = encodePath('Period', datasource_id, product_id, period_in_sec);
      // ISSUE: Period[].length >= 2 to ensure overlay
      this.subscriptions.push(
        this.terminal.consumeChannel<IPeriod[]>(channelId).subscribe((periods) => {
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
        }),
      );
    }
  }
  onDispose(): void | Promise<void> {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
