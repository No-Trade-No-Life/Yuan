import { IOHLC } from '@yuants/data-ohlc';
import { ISeriesCollectingTask } from '@yuants/data-series';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime } from '@yuants/utils';
import { defer, repeat, retry, Subscription, timeout } from 'rxjs';
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

  seriesIdList: string[] = [];

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
    const tasks = this.seriesIdList.map((series_id): ISeriesCollectingTask => {
      const [datasource_id, product_id, duration] = decodePath(series_id);
      return {
        table_name: 'ohlc',
        series_id: series_id,
        cron_pattern: mapDurationToCronPattern[duration] || '* * * * *',
        cron_timezone: 'GMT',
        disabled: false,
        replay_count: 5,
      };
    });

    await requestSQL(
      this.terminal,
      buildInsertManyIntoTableSQL(tasks, 'series_collecting_task', { ignoreConflict: true }),
    );

    // 配置行情查询任务
    for (const series_id of this.seriesIdList) {
      this.subscriptions.push(
        defer(async () => {
          const replay_count = 5;
          const series = this.periodDataUnit.data[series_id];
          const lastCreatedAt =
            series && series.length >= replay_count ? series[series.length - replay_count].created_at : 0;
          const sql = `select * from ohlc where series_id = ${escapeSQL(
            series_id,
          )} and created_at >= ${escapeSQL(formatTime(lastCreatedAt))} order by created_at`;
          this.kernel.log?.(
            `${formatTime(Date.now())} 正在加载周期数据: ${series_id}， 从 ${formatTime(
              lastCreatedAt,
            )}, SQL: ${sql}`,
          );

          const data = await requestSQL<IOHLC[]>(this.terminal, sql);
          return data;
        })
          .pipe(
            //
            timeout(5000),
            retry({ delay: 1000 }),
            repeat({ delay: 1000 }),
          )
          .subscribe((periods) => {
            const eventId = this.kernel.alloc(Date.now());
            this.mapEventIdToPeriod.set(eventId, periods);
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
