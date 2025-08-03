import { IOHLC } from '@yuants/data-ohlc';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { convertDurationToOffset, decodePath, encodePath, formatTime } from '@yuants/utils';
import { Kernel } from '../kernel';
import { BasicFileSystemUnit } from './BasicFileSystemUnit';
import { BasicUnit } from './BasicUnit';
import { PeriodDataUnit } from './PeriodDataUnit';
import { ProductDataUnit } from './ProductDataUnit';

const mapGroupBy = <T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> => {
  return array.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
    return map;
  }, new Map<K, T[]>());
};

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
  private mapEventIdToPeriod = new Map<number, IOHLC>();

  private fsUnit: BasicFileSystemUnit | undefined;

  periodTasks: {
    datasource_id: string;
    product_id: string;
    duration: string;
    start_time_in_us: number;
    end_time_in_us: number;
  }[] = [];

  async onInit() {
    this.fsUnit = this.kernel.findUnit(BasicFileSystemUnit);

    const queryData = async (key: string): Promise<IOHLC[]> => {
      const [datasource_id, product_id, duration, start, end] = decodePath(key);
      const t_start = new Date(start).getTime();
      const t_end = new Date(end).getTime();
      const ms = convertDurationToOffset(duration);
      const approximateLimit = 5000;
      const chunk_step = Math.ceil((approximateLimit * ms) / 86400_000) * 86400_000; // 每个 chunk 的时间跨度

      const result: IOHLC[] = [];
      const fetchList: Array<[number, number]> = [];

      if (this.fsUnit) {
        // 按照 n天 的方式存储 chunk，控制每个文件 5000 条数据左右

        const start_index = Math.floor(t_start / chunk_step);
        const end_index = Math.floor(t_end / chunk_step);

        for (let i = start_index; i <= end_index; i++) {
          const t = i * chunk_step;
          const filename = `/.Y/cache/ohlc/${encodeURIComponent(
            encodePath(datasource_id, product_id, duration),
          )}/${encodeURIComponent(formatTime(t).slice(0, 10))}.json`;
          this.kernel.log?.(`${formatTime(Date.now())} 正在从本地文件系统加载 ${filename}`);
          try {
            const content = await this.fsUnit.readFile(filename);
            if (content) {
              const data: IOHLC[] = JSON.parse(content);
              if (data.length > 0) {
                result.push(...data);
              }
              this.kernel.log?.(
                `${formatTime(Date.now())} 从本地文件系统加载 ${filename} 成功，共 ${data.length} 条数据`,
              );
            }
          } catch (error) {}
        }
      }

      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      this.kernel.log?.(
        `${formatTime(
          Date.now(),
        )} 从本地文件系统加载 "${datasource_id}" / "${product_id}" / "${duration}" 共 ${
          result.length
        } 条数据`,
      );

      if (result.length === 0) {
        fetchList.push([t_start, t_end]);
      } else {
        const cache_t_start = new Date(result[0].created_at).getTime();
        // 补充前面的数据
        if (t_start < cache_t_start) {
          fetchList.push([t_start, cache_t_start]);
        }
        const cache_t_end = new Date(result[result.length - 1].created_at).getTime();
        // 补充后面的数据
        if (t_end > cache_t_end) {
          fetchList.push([cache_t_end + 1, t_end]);
        }
        // TODO: 拆分 fetchList 为多个小的请求，避免单个请求过大导致超时
      }

      for (const [t1, t2] of fetchList) {
        this.kernel.log?.(
          `${formatTime(
            Date.now(),
          )} 正在从远程数据库加载 "${datasource_id}" / "${product_id}" / "${duration}" [${formatTime(
            t1,
          )}, ${formatTime(t2)}]`,
        );
        const sql = `select * from ohlc where series_id=${escapeSQL(
          encodePath(datasource_id, product_id, duration),
        )} and created_at >= ${escapeSQL(formatTime(t1))} and created_at < ${escapeSQL(formatTime(t2))}
            order by created_at`;
        const data = await requestSQL<IOHLC[]>(this.terminal, sql);

        this.kernel.log?.(
          `${formatTime(
            Date.now(),
          )} 从远程数据库加载 "${datasource_id}" / "${product_id}" / "${duration}" [${formatTime(
            t1,
          )}, ${formatTime(t2)}] 成功，共 ${data.length} 条数据`,
        );

        result.push(...data);

        // 将远程数据和本地数据合并
        if (this.fsUnit && data.length > 0) {
          const theMap = mapGroupBy(data, (item) => {
            const t = new Date(item.created_at).getTime();
            return Math.floor(t / chunk_step) * chunk_step;
          });

          for (const [start_time, chunk] of theMap) {
            const filename = `/.Y/cache/ohlc/${encodeURIComponent(
              encodePath(datasource_id, product_id, duration),
            )}/${encodeURIComponent(formatTime(start_time).slice(0, 10))}.json`;

            const oldData: IOHLC[] = await this.fsUnit
              .readFile(filename)
              .then((x) => JSON.parse(x || '[]'))
              .catch(() => []);

            const mergedData = [
              ...new Map(
                [...oldData, ...chunk].map((item) => [new Date(item.created_at).getTime(), item]),
              ).entries(),
            ]
              .sort((a, b) => a[0] - b[0])
              .map(([, item]) => item);

            await this.fsUnit?.writeFile(filename, JSON.stringify(mergedData, null, 2));

            this.kernel.log?.(
              `${formatTime(Date.now())} 写入本地文件系统 "${filename}" 共 ${mergedData.length} 条数据`,
            );
          }
        }
      }
      // 去重, 排序
      return [...new Map(result.map((item) => [new Date(item.created_at).getTime(), item])).values()].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    };

    this.kernel.log?.(`${formatTime(Date.now())} 正在加载历史行情数据: 共 ${this.periodTasks.length} 个任务`);
    for (const task of this.periodTasks) {
      this.kernel.log?.(
        `${formatTime(Date.now())} 正在加载 "${task.datasource_id}" / "${task.product_id}" / "${
          task.duration
        }" [${formatTime(task.start_time_in_us / 1000)}, ${formatTime(task.end_time_in_us / 1000)})`,
      );

      const data = await queryData(
        encodePath(
          task.datasource_id,
          task.product_id,
          task.duration,
          formatTime(task.start_time_in_us / 1000),
          formatTime(task.end_time_in_us / 1000),
        ),
      );

      if (!data)
        throw new Error(`No data found for ${task.datasource_id} / ${task.product_id} / ${task.duration}`);

      this.kernel.log?.(
        `${formatTime(Date.now())} 加载完毕 "${task.datasource_id}" / "${task.product_id}" / "${
          task.duration
        }" [${formatTime(task.start_time_in_us / 1000)}, ${formatTime(task.end_time_in_us / 1000)}) 共 ${
          data.length
        } 条数据`,
      );

      if (this.fsUnit) {
        await this.fsUnit.writeFile(
          `/.Y/cache/ohlc/${encodeURIComponent(
            encodePath(task.datasource_id, task.product_id, task.duration),
          )}.csv`,
          JSON.stringify(data, null, 2),
        );
      }

      data.forEach((period, idx) => {
        // 推入 Period 数据
        // ISSUE: 将开盘时的K线也推入队列，产生一个模拟的事件，可以提早确认上一根K线的收盘
        const openEventId = this.kernel.alloc(new Date(period.created_at).getTime());
        this.mapEventIdToPeriod.set(openEventId, {
          ...period,
          high: period.open,
          low: period.open,
          close: period.open,
          open: period.open,
          volume: '0',
        });
        // ISSUE: 一般来说，K线的收盘时间戳是开盘时间戳 + 周期，但是在历史数据中，K线的收盘时间戳可能会比开盘时间戳 + 周期要早
        const inferred_close_timestamp = Math.min(
          new Date(period.closed_at).getTime() - 1,
          (data[idx + 1] ? new Date(data[idx + 1].created_at).getTime() : Infinity) - 1,
          Date.now(),
        );
        const closeEventId = this.kernel.alloc(inferred_close_timestamp);
        this.mapEventIdToPeriod.set(closeEventId, period);
      });
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
      Object.entries(state.mapEventIdToPeriod).map(([k, v]: [string, any]): [number, IOHLC] => [
        Number(k),
        v,
      ]),
    );
  }
}
