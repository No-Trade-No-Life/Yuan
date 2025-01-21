import {
  addDataRecordSchema,
  addDataRecordWrapper,
  encodePath,
  getDataRecordWrapper,
  IDataRecord,
  IDataRecordTypes,
} from '@yuants/data-model';
import { escapeRegExp, IService, IServiceOptions, Terminal, writeDataRecords } from '@yuants/protocol';
import { observableToAsyncIterable } from '@yuants/utils';
import { defer } from 'rxjs';

declare module '@yuants/data-model/lib/DataRecord' {
  interface IDataRecordTypes {
    series_collecting_task: {
      /** Type of the Data record to collect */
      type: string;
      /** series id is a path to identify a data series */
      series_id: string;
      /** Pattern of CronJob */
      cron_pattern: string;
      /** Timezone for CronJob evaluation */
      cron_timezone: string;
      /** disable this relation (false equivalent to not set before) */
      disabled?: boolean;
      /** default to 0, means start from the latest data record, above 0 means pull start from earlier data records */
      replay_count?: number;
    };
  }
}

declare module '@yuants/protocol' {
  interface IService {
    CollectDataSeries: {
      req: {
        type: string;
        series_id: string;
        started_at: number;
        ended_at: number;
      };
      frame: { fetched: number; saved: number; fetched_at: number; saved_at: number };
      res: { code: number; message: string };
    };
  }
}

addDataRecordWrapper('series_collecting_task', (x) => {
  return {
    id: encodePath(x.type, x.series_id),
    type: 'series_collecting_task',
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: x,
  };
});

addDataRecordSchema('series_collecting_task', {
  type: 'object',
  required: ['type', 'series_id', 'cron_pattern', 'cron_timezone'],
  properties: {
    type: {
      type: 'string',
      title: 'Type of Data Record',
    },
    series_id: {
      type: 'string',
      title: 'Series ID',
    },
    cron_pattern: {
      type: 'string',
      title: 'Pattern of CronJob: when to pull data',
    },
    cron_timezone: {
      type: 'string',
      title: 'Timezone of CronJob',
    },
    replay_count: {
      type: 'number',
      title: 'Replay Count',
    },
    disabled: {
      type: 'boolean',
      title: 'Disable this relation',
    },
  },
});
/**
 * 原生的可迭代对象
 * @public
 */
export type NativeIterable<T> = AsyncIterable<T> | PromiseLike<T> | ArrayLike<T> | Iterable<T>;
/**
 * 为数据序列提供数据
 * @public
 */
export const provideDataSeries = <T extends keyof IDataRecordTypes>(
  terminal: Terminal,
  ctx: {
    /**
     * 数据序列的类型
     */
    type: T;
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
    queryFn: (ctx: {
      series_id: string;
      started_at: number;
      ended_at: number;
    }) => NativeIterable<IDataRecordTypes[T][]>;
    serviceOptions?: IServiceOptions;
  },
) => {
  return terminal.provideService(
    'CollectDataSeries',
    {
      type: 'object',
      required: ['type', 'series_id', 'started_at', 'ended_at'],
      properties: {
        type: { const: ctx.type },
        series_id: {
          type: 'string',
          pattern: `^${escapeRegExp(encodePath(ctx.series_id_prefix_parts))}/`,
        },
        started_at: { type: 'number' },
        ended_at: { type: 'number' },
      },
    },
    async function* (msg) {
      const { series_id, started_at, ended_at } = msg.req;
      const status: IService['CollectDataSeries']['frame'] = {
        fetched: 0,
        saved: 0,
        fetched_at: ctx.reversed ? ended_at : started_at,
        saved_at: started_at,
      };
      const dataRecordsDeferred: IDataRecord<IDataRecordTypes[T]>[] = [];
      for await (const data of observableToAsyncIterable(
        defer(() => ctx.queryFn({ series_id, started_at, ended_at })),
      )) {
        if (data.length == 0) {
          yield { frame: status };
          continue;
        }
        const dataRecords = data.map(getDataRecordWrapper(ctx.type)!);
        if (ctx.reversed) {
          dataRecords.forEach((x) => {
            dataRecordsDeferred.push(x);
          });
        }
        status.fetched_at = ctx.reversed
          ? dataRecords.reduce((acc, x) => Math.min(acc, x.created_at || -Infinity), status.fetched_at)
          : dataRecords.reduce((acc, x) => Math.max(acc, x.created_at || -Infinity), status.fetched_at);
        status.fetched += data.length;
        yield { frame: status };
        if (!ctx.reversed) {
          await writeDataRecords(terminal, dataRecords);
          status.saved_at = dataRecords.reduce(
            (acc, x) => Math.max(acc, x.created_at || -Infinity),
            status.saved_at,
          );
          status.saved += data.length;
          yield { frame: status };
        }
        // automatically stop if the data is not in the range
        if (ctx.reversed) {
          if (status.fetched_at <= started_at) break;
        } else {
          if (status.fetched_at >= ended_at) break;
        }
      }
      if (dataRecordsDeferred.length > 0) {
        await writeDataRecords(terminal, dataRecordsDeferred);
      }
      yield { res: { code: 0, message: 'OK' } };
    },
    ctx.serviceOptions,
  );
};
