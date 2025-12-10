import { IServiceOptions, Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { encodePath, escapeRegExp, observableToAsyncIterable } from '@yuants/utils';
import { defer, ObservableInput } from 'rxjs';

/**
 * 数据序列收集任务的接口
 *
 * @public
 */
export interface ISeriesCollectingTask {
  /** Type of the Data record to collect */
  table_name: string;
  /** series id is a path to identify a data series */
  series_id: string;
  /** Pattern of CronJob */
  cron_pattern: string;
  /** Timezone for CronJob evaluation */
  cron_timezone: string;
  /** disable this relation (false equivalent to not set before) */
  disabled: boolean;
  /** default to 0, means start from the latest data record, above 0 means pull start from earlier data records */
  replay_count: number;
}

/**
 * 数据序列数据项的接口
 *
 * 实现该接口后，数据可以被 `createSeriesProvider` 函数处理
 *
 * @public
 */
export interface ISeriesDataItem {
  series_id: string;
  created_at: string;
}

/**
 * 提供数据序列所需的上下文
 * @public
 */
export interface ISeriesProviderContext<T extends ISeriesDataItem> {
  /**
   * 数据表的名称
   */
  tableName: string;
  /**
   * 数据序列的 ID 的前置部分
   */
  series_id_prefix_parts: string[];
  /**
   * 数据页之间的顺序是否为 从最新到最旧
   *
   * - 如果 true，需要加载完全部数据页后再写入数据
   * - 如果 false，即每次写入数据页后就立即写入数据
   */
  reversed: boolean;
  /**
   * 查询数据的函数
   *
   * - 可以分批返回数据页
   * - 数据页的内部不需要排序
   * - 必须在短时间内返回一批数据，否则会被认为超时，如果没有数据，可以返回空数组
   * - 如果数据不在范围内，调度器会自动停止查询，不需要在 queryFn 中处理
   */
  queryFn: (ctx: { series_id: string; started_at: number; ended_at: number }) => ObservableInput<T[]>;

  serviceOptions?: IServiceOptions;
}

/**
 * 为数据序列提供数据
 * @public
 */
export const createSeriesProvider = <T extends ISeriesDataItem>(
  terminal: Terminal,
  ctx: ISeriesProviderContext<T>,
) => {
  interface IFrame {
    /**
     * 已获取的数据条数
     */
    fetched: number;
    /**
     * 已保存的数据条数
     */
    saved: number;
    /**
     * 已获取数据的时间戳 (ms)
     */
    fetched_at: number;
    /**
     * 已保存数据的时间戳 (ms)
     */
    saved_at: number;
  }

  return terminal.server.provideService<
    {
      /**
       * 目标数据表的名称
       */
      table_name: string;
      /**
       * 数据序列的 ID
       */
      series_id: string;
      /**
       * 数据序列的起始时间戳 (ms)
       */
      started_at: number;
      /**
       * 数据序列的结束时间戳 (ms)
       */
      ended_at: number;
    },
    void,
    IFrame
  >(
    'CollectSeries',
    {
      type: 'object',
      required: ['table_name', 'series_id', 'started_at', 'ended_at'],
      properties: {
        table_name: { const: ctx.tableName },
        series_id: {
          type: 'string',
          pattern: `^${escapeRegExp(encodePath(...ctx.series_id_prefix_parts))}/`,
        },
        started_at: { type: 'number' },
        ended_at: { type: 'number' },
      },
    },
    async function* (msg) {
      // @ts-ignore
      const { series_id, started_at, ended_at } = msg.req;
      const status: IFrame = {
        fetched: 0,
        saved: 0,
        fetched_at: ctx.reversed ? ended_at : started_at,
        saved_at: ctx.reversed ? ended_at : started_at,
      };
      for await (const data of observableToAsyncIterable(
        defer(() => ctx.queryFn({ series_id, started_at, ended_at })),
      )) {
        if (data.length == 0) {
          yield { frame: status };
          continue;
        }
        status.fetched_at = ctx.reversed
          ? data.reduce(
              (acc, x) => Math.min(acc, new Date(x.created_at).getTime() || -Infinity),
              status.fetched_at,
            )
          : data.reduce(
              (acc, x) => Math.max(acc, new Date(x.created_at).getTime() || -Infinity),
              status.fetched_at,
            );
        status.fetched += data.length;
        yield { frame: status };
        // 无论 reversed 与否，都需要先将数据写入数据库，保证数据逐渐积累，避免内存溢出
        await requestSQL(
          terminal,
          buildInsertManyIntoTableSQL(data, ctx.tableName, {
            conflictKeys: ['series_id', 'created_at'],
          }),
        );
        status.saved += data.length;
        if (ctx.reversed) {
          status.saved_at = data.reduce(
            (acc, x) => Math.min(acc, new Date(x.created_at).getTime() || Infinity),
            status.saved_at,
          );
        } else {
          status.saved_at = data.reduce(
            (acc, x) => Math.max(acc, new Date(x.created_at).getTime() || -Infinity),
            status.saved_at,
          );
        }
        yield { frame: status };
        // automatically stop if the data is not in the range
        if (ctx.reversed) {
          if (status.fetched_at <= started_at) break;
        } else {
          if (status.fetched_at >= ended_at) break;
        }
      }
      yield { res: { code: 0, message: 'OK' } };
    },
    ctx.serviceOptions,
  );
};
