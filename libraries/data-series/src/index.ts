import { encodePath, getDataRecordWrapper, IDataRecord, IDataRecordTypes } from '@yuants/data-model';
import { escapeRegExp, IService, IServiceOptions, Terminal, writeDataRecords } from '@yuants/protocol';
import { observableToAsyncIterable } from '@yuants/utils';
import { defer } from 'rxjs';

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

type NativeIterable<T> = Promise<T> | AsyncIterable<T> | Iterable<T>;

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
        const minCreatedAt = dataRecords.reduce(
          (acc, x) => Math.min(acc, x.created_at || -Infinity),
          Infinity,
        );
        const maxCreatedAt = dataRecords.reduce(
          (acc, x) => Math.max(acc, x.created_at || -Infinity),
          -Infinity,
        );
        status.fetched_at = ctx.reversed ? minCreatedAt : maxCreatedAt;
        status.fetched += data.length;
        yield { frame: status };
        if (!ctx.reversed) {
          await writeDataRecords(terminal, dataRecords);
          status.saved_at = maxCreatedAt;
          status.saved += data.length;
          yield { frame: status };
        }
      }
      if (dataRecordsDeferred.length > 0) {
        await writeDataRecords(terminal, dataRecordsDeferred);
      }
      return { res: { code: 0, message: 'OK' } };
    },
    ctx.serviceOptions,
  );
};
