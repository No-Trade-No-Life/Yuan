import { UUID, formatTime } from '@yuants/data-model';
import { IDataRecord, PromRegistry, Terminal } from '@yuants/protocol';
import { MongoClient } from 'mongodb';
import { bufferTime, concatWith, delayWhen, from, groupBy, map, mergeMap, of, tap, toArray } from 'rxjs';

const HOST_URL = process.env.HOST_URL || process.env.HV_URL!;
const TERMINAL_ID = process.env.TERMINAL_ID || `MongoDB/${UUID()}`;
const terminal = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  name: 'MongoDB Storage',
});

const mongo = new MongoClient(process.env.MONGO_URI!);

const db = mongo.db();

db.stats().then((v) => {
  console.info(formatTime(Date.now()), 'Connected', JSON.stringify(v));
  terminal.terminalInfo.status = 'OK';
});

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
terminal.provideService('UpdateDataRecords', {}, (msg) => {
  const startTime = Date.now();
  return from(msg.req)
    .pipe(
      groupBy((record) => record.type),
      mergeMap((group) => {
        const collection = db.collection(group.key);
        return group.pipe(
          toArray(),
          tap((records) => {
            console.info(formatTime(Date.now()), `数据集 ${group.key} 准备写入 ${records.length} 条数据`);
          }),
          delayWhen((records) =>
            from(
              collection.createIndexes([
                //
                { key: { id: 1 }, unique: true },
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
                ...Object.keys(records[0].tags).map((key) => ({ key: { ['tags.' + key]: 1 } })),
              ]),
            ),
          ),
          tap((records) => {
            console.info(formatTime(Date.now()), `数据集 ${group.key} 维护索引完毕`);
          }),

          mergeMap((records) =>
            from(records).pipe(
              map((record) => ({
                updateOne: {
                  filter: { id: record.id },
                  update: { $set: record as any },
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
              `数据集 ${group.key} 批量写入结果 ${records.ok};`,
              `新增 ${records.upsertedCount} 条;`,
              `插入 ${records.insertedCount} 条;`,
              `更新 ${records.modifiedCount} 条;`,
            );
            const total = records.upsertedCount + records.insertedCount + records.modifiedCount;
            MetricWriteRecordsTotal.add(total, {
              type: group.key,
              source_terminal_id: msg.source_terminal_id ?? 'unknown',
              target_terminal_id: TERMINAL_ID,
            });
            MetricWriteDurationBucket.observe(Date.now() - startTime, {
              type: group.key,
              source_terminal_id: msg.source_terminal_id ?? 'unknown',
              target_terminal_id: TERMINAL_ID,
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
});

terminal.provideService('RemoveDataRecords', {}, (msg) => {
  if (!msg.req.type) {
    return of({ res: { code: 400, message: `Must provide type` } });
  }
  const collection = db.collection(msg.req.type);
  console.info(formatTime(Date.now()), `数据集 ${msg.req.type} 准备删除数据`, msg.req);

  return from(collection.deleteMany({ id: msg.req.id })).pipe(
    tap((result) => {
      console.info(
        formatTime(Date.now()),
        `数据集 ${msg.req.type} 删除数据结果:`,
        `删除 ${result.deletedCount} 条;`,
      );
    }),
    // 返回一个空对象，防止客户端超时报错
    bufferTime(2000),
    mergeMap(() => of({})),
    concatWith(of({ res: { code: 0, message: 'OK' } })),
  );
});

terminal.provideService('QueryDataRecords', {}, (msg) => {
  if (!msg.req.type) {
    return of({ res: { code: 400, message: `Must provide type` } });
  }
  const startTime = Date.now();
  const collection = db.collection(msg.req.type);

  console.info(formatTime(Date.now()), `数据集 ${msg.req.type} 准备查询数据`, msg.req);

  // 按时间查找的情况
  const cursor = collection.find<IDataRecord<any>>(
    {
      $and: [
        // 按照 ID 查找
        ...(msg.req.id ? [{ id: msg.req.id }] : []),
        // 根据 tags 取值过滤
        Object.fromEntries(Object.entries(msg.req.tags || {}).map(([key, value]) => [`tags.${key}`, value])),
        // 按更新时间查询
        ...(msg.req.updated_since ? [{ updated_at: { $gt: msg.req.updated_since } }] : []),
        // 是否包含过期数据
        ...(msg.req.include_expired
          ? []
          : [{ $or: [{ expired_at: null }, { expired_at: { $gt: Date.now() } }] }]),
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
                  { created_at: { $gte: msg.req.time_range[0], $lt: msg.req.time_range[1] } },
                  { frozen_at: { $gt: msg.req.time_range[0], $lte: msg.req.time_range[1] } },
                ],
              },
            ]
          : []),
        // 按照 JSON Schema 查询
        ...(msg.req.json_schema ? [{ $jsonSchema: msg.req.json_schema }] : []),
      ],
    },
    {
      skip: msg.req.options?.skip,
      limit: msg.req.options?.limit,
      sort: msg.req.options?.sort?.map((rule): [string, -1 | 1] => [rule[0], rule[1] < 0 ? -1 : 1]),
    },
  );
  return from(cursor.stream()).pipe(
    //
    bufferTime(2000),
    tap({
      next: (data) => {
        MetricReadRecordsTotal.add(data.length, {
          type: msg.req.type,
          source_terminal_id: msg.source_terminal_id ?? 'unknown',
          target_terminal_id: TERMINAL_ID,
        });
      },
      complete: () => {
        cursor.close();
        MetricReadDurationBucket.observe(Date.now() - startTime, {
          type: msg.req.type,
          source_terminal_id: msg.source_terminal_id ?? 'unknown',
          target_terminal_id: TERMINAL_ID,
        });
      },
    }),
    map((records) => ({ frame: records })),
    concatWith(of({ res: { code: 0, message: 'OK' } })),
    tap((data) => {
      console.info(formatTime(Date.now()), `数据集 ${msg.req.type} 查询结果`);
    }),
  );
});
