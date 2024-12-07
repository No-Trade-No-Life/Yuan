import { formatTime, IDataRecord, UUID } from '@yuants/data-model';
import { PromRegistry, Terminal } from '@yuants/protocol';
import { fromPrivateKey, listWatch, signMessage } from '@yuants/utils';
import { MongoClient } from 'mongodb';
import {
  bufferTime,
  concatWith,
  delayWhen,
  from,
  groupBy,
  map,
  mergeMap,
  Observable,
  of,
  repeat,
  retry,
  tap,
  toArray,
} from 'rxjs';

const MetricReadRecordsTotal = PromRegistry.create(
  'counter',
  'storage_read_records_total',
  'storage_read_records_total Total read records from Storage, e.g. mongodb',
);

const MetricReadDurationBucket = PromRegistry.create(
  'histogram',
  'storage_read_duration_milliseconds',
  'storage_read_duration_milliseconds Storage read duration bucket in 1, 10, 100, 1000, 10000, 30000 ms',
  [1, 10, 100, 1000, 10000, 30_000],
);

const MetricWriteRecordsTotal = PromRegistry.create(
  'counter',
  'storage_write_records_total',
  'storage_write_records_total Total write records to Storage, e.g. mongodb',
);

const MetricWriteDurationBucket = PromRegistry.create(
  'histogram',
  'storage_write_duration_milliseconds',
  'storage_write_duration_milliseconds Storage write duration bucket in 1, 10, 100, 1000, 10000, 30000 ms',
  [1, 10, 100, 1000, 10000, 30_000],
);

interface IHostRecord {
  public_key: string;
  signature: string;
}

interface IHostScopedDataRecords<T> extends IDataRecord<T> {
  public_key: string;
}

// Setup Admin Terminal
const ADMIN_KEY_PAIR = fromPrivateKey(process.env.ADMIN_PRIVATE_KEY!);

const adminHostTerminal = new Terminal(
  `${process.env.HOST_URL_BASE!}?public_key=${ADMIN_KEY_PAIR.public_key}&signature=${signMessage(
    '',
    ADMIN_KEY_PAIR.private_key,
  )}`,
  {
    terminal_id: `MongoDBSupervisor/${UUID()}`,
    name: 'mongo DB Supervisor',
  },
);

const mongo = new MongoClient(process.env.MONGO_URI!);
const db = mongo.db();

from(adminHostTerminal.requestService('ListHost', {}))
  .pipe(
    map((msg) => (msg.res?.data ?? []) as IHostRecord[]),
    retry({ delay: 5_000 }),
    repeat({ delay: 30_000 }),
  )
  .pipe(
    listWatch(
      (item: IHostRecord) => item.public_key,
      (item) => {
        return new Observable<{ terminal: Terminal; hostRecord: IHostRecord }>((subscriber) => {
          const hostURL = `${process.env.HOST_URL_BASE}?public_key=${item.public_key}&signature=${item.signature}`;
          console.info(formatTime(Date.now()), `SetupTerminalFor: ${hostURL}`);
          const terminal = new Terminal(hostURL, {
            terminal_id: `NamespacedMongoDB/${UUID()}`,
            name: 'Namespaced MongoDB Storage',
          });

          subscriber.next({ terminal, hostRecord: item });
          return () => {
            terminal.dispose();
          };
        });
      },
    ),
    tap(({ terminal, hostRecord }) => {
      terminal.provideService('Terminate', {}, async (msg) => {
        return {
          res: {
            code: 403,
            message: `You are not allowed to terminate this terminal`,
          },
        };
      });
      terminal.provideService(
        'UpdateDataRecords',
        {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'id', 'tags', 'updated_at', 'origin'],
            properties: {
              type: {
                type: 'string',
              },
              id: {
                type: 'string',
              },
              tags: {
                type: 'object',
              },
              created_at: {
                type: ['number', 'null'],
              },
              updated_at: {
                type: 'number',
              },
              frozen_at: {
                type: ['number', 'null'],
              },
              origin: {
                type: 'object',
              },
            },
          },
        },
        (msg) => {
          const startTime = Date.now();
          return from(msg.req)
            .pipe(
              groupBy((record) => record.type),
              mergeMap((group) => {
                const collection = db.collection(group.key);
                return group.pipe(
                  map(
                    (record): IHostScopedDataRecords<unknown> => ({
                      ...record,
                      public_key: hostRecord.public_key,
                    }),
                  ),
                  toArray(),
                  tap((records) => {
                    console.info(
                      formatTime(Date.now()),
                      `public_key: ${hostRecord.public_key}`,
                      `数据集 ${group.key} 准备写入 ${records.length} 条数据`,
                    );
                  }),
                  delayWhen((records) =>
                    from(
                      collection.createIndexes([
                        //
                        { key: { id: 1, host_id: 1 }, unique: true },
                        {
                          key: { created_at: 1 },
                        },
                        {
                          key: { updated_at: 1 },
                        },
                        {
                          key: { frozen_at: 1 },
                        },
                        // Create indexes for all tags
                        ...Object.keys(records[0].tags).map((key) => ({
                          key: { ['tags.' + key]: 1 },
                        })),
                      ]),
                    ),
                  ),
                  tap((records) => {
                    console.info(
                      formatTime(Date.now()),
                      `public_key: ${hostRecord.public_key}`,
                      `数据集 ${group.key} 维护索引完毕`,
                    );
                  }),

                  mergeMap((records) =>
                    from(records).pipe(
                      map((record) => ({
                        replaceOne: {
                          filter: { id: record.id, public_key: record.public_key },
                          replacement: record as any,
                          upsert: true,
                        },
                      })),
                      toArray(),
                    ),
                  ),
                  mergeMap((updateManyOps) => collection.bulkWrite(updateManyOps)),
                  tap((records) => {
                    console.info(
                      formatTime(Date.now()),
                      `public_key: ${hostRecord.public_key}`,
                      `数据集 ${group.key} 批量写入结果 ${records.ok};`,
                      `新增 ${records.upsertedCount} 条;`,
                      `插入 ${records.insertedCount} 条;`,
                      `更新 ${records.modifiedCount} 条;`,
                    );
                    MetricWriteRecordsTotal.add(records.upsertedCount, {
                      type: group.key,
                      public_key: hostRecord.public_key,
                      source_terminal_id: msg.source_terminal_id ?? 'unknown',
                      target_terminal_id: terminal.terminal_id,
                    });
                    MetricWriteDurationBucket.observe(Date.now() - startTime, {
                      type: group.key,
                      public_key: hostRecord.public_key,
                      source_terminal_id: msg.source_terminal_id ?? 'unknown',
                      target_terminal_id: terminal.terminal_id,
                    });
                  }),
                );
              }),
            )
            .pipe(
              // 返回一个空对象，防止客户端超时报错
              bufferTime(2000),
              mergeMap(() => of({})),
              map(() => ({ res: { code: 0, message: 'OK' } })),
            );
        },
      );

      terminal.provideService(
        'RemoveDataRecords',
        {
          required: ['type', 'id'],
          properties: {
            type: {
              type: 'string',
            },
            id: {
              type: 'string',
            },
          },
        },
        (msg) => {
          if (!msg.req.type) {
            return of({ res: { code: 400, message: `Must provide type` } });
          }
          const collection = db.collection(msg.req.type);
          console.info(
            formatTime(Date.now()),
            `public_key: ${hostRecord.public_key}`,
            `数据集 ${msg.req.type} 准备删除数据`,
            msg.req,
          );

          return from(collection.deleteMany({ id: msg.req.id, public_key: hostRecord.public_key })).pipe(
            tap((result) => {
              console.info(
                formatTime(Date.now()),
                `public_key: ${hostRecord.public_key}`,
                `数据集 ${msg.req.type} 删除数据结果:`,
                `删除 ${result.deletedCount} 条;`,
              );
            }),
            // 返回一个空对象，防止客户端超时报错
            bufferTime(2000),
            mergeMap(() => of({})),
            concatWith(of({ res: { code: 0, message: 'OK' } })),
          );
        },
      );

      terminal.provideService(
        'QueryDataRecords',
        {
          required: ['type'],
          properties: {
            type: {
              type: 'string',
            },
            tags: {
              type: 'object',
            },
          },
          not: {
            properties: {
              type: { enum: ['period'] },
              tags: {
                type: 'object',
                required: ['datasource_id'],
                properties: {
                  datasource_id: {
                    const: 'Y',
                  },
                },
              },
            },
          },
        },
        (msg) => {
          if (!msg.req.type) {
            return of({ res: { code: 400, message: `Must provide type` } });
          }
          const startTime = Date.now();
          const collection = db.collection(msg.req.type);

          console.info(
            formatTime(Date.now()),
            `public_key: ${hostRecord.public_key}`,
            `数据集 ${msg.req.type} 准备查询数据`,
            msg.req,
          );

          // 按时间查找的情况
          const cursor = collection.find<IDataRecord<any>>(
            {
              $and: [
                // 按照 Host ID 查找
                { public_key: hostRecord.public_key },
                // 按照 ID 查找
                ...(msg.req.id ? [{ id: msg.req.id }] : []),
                // 根据 tags 取值过滤
                Object.fromEntries(
                  Object.entries(msg.req.tags || {}).map(([key, value]) => [`tags.${key}`, value]),
                ),
                // 按更新时间查询
                ...(msg.req.updated_since ? [{ updated_at: { $gt: msg.req.updated_since } }] : []),
                // 按时间段查询
                ...(msg.req.time_range
                  ? [
                      // [created_at, frozen_at) 与 [time_range[0], time_range[1]) 有交集的情况
                      // 1. created_at === null && frozen_at === null
                      // 2. created_at === null && frozen_at > time_range[0]
                      // 3. created_at < time_range[1] && frozen_at === null
                      // 4. time_range[0] <= created_at < time_range[1]
                      // 5. time_range[0] < frozen_at <= time_range[1]
                      {
                        $or: [
                          //
                          { created_at: null, frozen_at: null },
                          { created_at: null, frozen_at: { $gt: msg.req.time_range[0] } },
                          { created_at: { $lt: msg.req.time_range[1] }, frozen_at: null },
                          {
                            created_at: { $gte: msg.req.time_range[0], $lt: msg.req.time_range[1] },
                          },
                          { frozen_at: { $gt: msg.req.time_range[0], $lte: msg.req.time_range[1] } },
                        ],
                      },
                    ]
                  : []),
              ],
            },
            {
              skip: msg.req.options?.skip,
              limit: msg.req.options?.limit,
              sort: msg.req.options?.sort?.map((rule): [string, -1 | 1] => [rule[0], rule[1] < 0 ? -1 : 1]),
              projection: {
                host_id: 0,
              },
            },
          );
          return from(cursor.stream()).pipe(
            //
            bufferTime(2000),
            tap({
              next: (data) => {
                MetricReadRecordsTotal.add(data.length, {
                  type: msg.req.type,
                  public_key: hostRecord.public_key,
                  source_terminal_id: msg.source_terminal_id ?? 'unknown',
                  target_terminal_id: terminal.terminal_id,
                });
              },
              complete: () => {
                MetricReadDurationBucket.observe(Date.now() - startTime, {
                  type: msg.req.type,
                  public_key: hostRecord.public_key,
                  source_terminal_id: msg.source_terminal_id ?? 'unknown',
                  target_terminal_id: terminal.terminal_id,
                });
              },
            }),
            map((records) => ({ frame: records })),
            concatWith(of({ res: { code: 0, message: 'OK' } })),
            tap((data) => {
              console.info(
                formatTime(Date.now()),
                `public_key: ${hostRecord.public_key}`,
                `数据集 ${msg.req.type} 查询结果`,
              );
            }),
          );
        },
      );

      terminal.provideService('Terminate', {}, (msg) => {
        return of({
          res: {
            code: 403,
            message: `You are not allowed to terminate this terminal`,
          },
        });
      });
    }),
  )
  .subscribe();
