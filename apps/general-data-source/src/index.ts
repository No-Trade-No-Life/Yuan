import { IPeriod } from '@yuants/data-model';
import { PromRegistry, Terminal } from '@yuants/protocol';
import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  catchError,
  defer,
  delayWhen,
  first,
  from,
  groupBy,
  interval,
  map,
  mergeMap,
  of,
  repeat,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import { mergeSort } from './utils';

// GSR
interface IGeneralSpecificRelation {
  // general_datasource_id 一定是 Y 常量，因此不需要特别存储
  // general_datasource_id: string;
  /** 标准品种ID */
  general_product_id: string; // XAUUSD
  /** 具体数据源 ID */
  specific_datasource_id: string; // TradingView
  /** 具体品种 ID */
  specific_product_id: string; // FX:XAUUSD
}

const MetricSyncDurationBucket = PromRegistry.create('histogram', 'general_data_source_sync_duration_bucket');

const MetricSyncStatus = PromRegistry.create('gauge', 'general_data_source_sync_status');

const schema: JSONSchema7 = {
  type: 'object',
  title: '标准行情关系',
  properties: {
    general_product_id: {
      type: 'string',
      title: '标准品种 ID',
    },
    specific_datasource_id: {
      type: 'string',
      title: '具体数据源 ID',
    },
    specific_product_id: {
      type: 'string',
      title: '具体品种 ID',
    },
  },
};

const ajv = new Ajv();
const validate = ajv.compile(schema);

const HV_URL = process.env.HV_URL!;
const QUERY_CONCURRENCY = +process.env.QUERY_CONCURRENCY! || 10;
const TERMINAL_ID = process.env.TERMINAL_ID || 'GeneralDataSource';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'General Data Source',
  status: 'OK',
});

const syncData = (
  general_product_id: string,
  period_in_sec: number,
  gsrList: IGeneralSpecificRelation[],
  time_range: [number, number],
): Observable<IPeriod[]> => {
  const startTime = Date.now();
  const [start, end] = time_range;
  console.info(
    new Date(),
    `GeneralDataSourceSyncStarted`,
    `product_id: ${general_product_id}, period: ${period_in_sec}, time range: [${start}, ${end}], gsr: [${gsrList
      .map((v) => `${v.specific_datasource_id}-${v.specific_product_id}`)
      .join(', ')}]`,
  );
  return from(gsrList).pipe(
    //
    map((gsr) =>
      defer(() =>
        term.queryDataRecords<IPeriod>({
          type: 'period',
          tags: {
            datasource_id: gsr.specific_datasource_id,
            product_id: gsr.specific_product_id,
            period_in_sec: '' + period_in_sec,
          },
          time_range: [start, end],
        }),
      ).pipe(
        //
        map((v) => v.origin),
      ),
    ),
    toArray(),
    mergeMap((period$List) =>
      mergeSort(period$List, (a, b) => a.timestamp_in_us - b.timestamp_in_us).pipe(
        //
        map((periods) => ({
          datasource_id: 'Y',
          product_id: general_product_id,
          period_in_sec,
          timestamp_in_us: +periods[0].timestamp_in_us,
          open: periods.map((v) => v.open).reduce((acc, cur) => acc + cur, 0) / periods.length,
          high: periods.map((v) => v.high).reduce((acc, cur) => Math.max(acc, cur), -Infinity),
          low: periods.map((v) => v.low).reduce((acc, cur) => Math.min(acc, cur), Infinity),
          close: periods.map((v) => v.close).reduce((acc, cur) => acc + cur, 0) / periods.length,
          volume: periods.map((v) => v.volume).reduce((acc, cur) => acc + cur, 0) / periods.length,
        })),
      ),
    ),
    toArray(),
    tap((v) => {
      console.info(
        new Date(),
        `general product: ${general_product_id}, period: ${period_in_sec} calculation done, total ${v.length} periods`,
      );
    }),
    tap(() => {
      console.info(new Date(), `general product: ${general_product_id}, period: ${period_in_sec} complete`);
      // MetricSyncDurationBucket.observe(Date.now() - startTime, {
      //   status: 'success',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
      // MetricSyncStatus.set(1, {
      //   status: 'running',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
      // MetricSyncStatus.set(0, {
      //   status: 'error',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
    }),
    catchError((err) => {
      console.info(
        new Date(),
        `general product: ${general_product_id}, period: ${period_in_sec} failed`,
        err,
      );
      // MetricSyncDurationBucket.observe(Date.now() - startTime, {
      //   status: 'error',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
      // MetricSyncStatus.set(0, {
      //   status: 'running',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
      // MetricSyncStatus.set(1, {
      //   status: 'error',
      //   general_product_id: general_product_id,
      //   period_in_sec: '' + period_in_sec,
      // });
      return EMPTY;
    }),
  );
};

const mapProductIdToGSRList$ = defer(() =>
  term.queryDataRecords<IGeneralSpecificRelation>({
    type: 'general_specific_relation',
  }),
).pipe(
  //
  map((record) => {
    const config = record.origin;
    if (!validate(config)) {
      throw new Error(`invalid config: ${JSON.stringify(config)}`);
    }
    return config;
  }),
  groupBy((gsr) => gsr.general_product_id),
  mergeMap((group) =>
    group.pipe(
      toArray(),
      map((gsrList) => [group.key, gsrList] as const),
    ),
  ),
  toArray(),
  repeat({ delay: 30_000 }),
  map((v): Record<string, IGeneralSpecificRelation[]> => Object.fromEntries(v)),
  shareReplay(1),
);

term.provideService(
  'CopyDataRecords',
  {
    required: ['type', 'tags'],
    properties: {
      type: { const: 'period' },
      tags: {
        required: ['datasource_id'],
        properties: {
          datasource_id: { const: 'Y' },
        },
      },
    },
  },
  (msg, output$) => {
    if (msg.req.tags?.product_id === undefined || msg.req.tags?.period_in_sec === undefined) {
      return of({ res: { code: 400, message: 'product_id or period_in_sec is required' } });
    }
    const { product_id, period_in_sec } = msg.req.tags;
    const [start_time, end_time] = msg.req.time_range || [0, Date.now()];
    console.info(new Date(), `CopyDataRecords`, JSON.stringify(msg.req));

    // keep alive
    const keepalive = interval(5_000).subscribe(() => {
      output$.next({});
    });

    return mapProductIdToGSRList$.pipe(
      first(),
      map((mapProductIdToGSRList) => {
        const gsrList = mapProductIdToGSRList[product_id];
        if (!gsrList) {
          throw new Error(`product_id: ${product_id} 不存在`);
        }
        return gsrList;
      }),
      mergeMap((gsrList) =>
        syncData(product_id, +period_in_sec, gsrList, [start_time, end_time]).pipe(
          //
          delayWhen((periods) => term.updatePeriods(periods)),
        ),
      ),
      tap((periods) => {
        console.debug(new Date(), `CopyDataRecords`, `返回了 ${periods.length} 条数据`);
      }),
      tap({
        finalize: () => {
          keepalive.unsubscribe();
        },
      }),
      map(() => ({
        res: {
          code: 0,
          message: 'OK',
        },
      })),
      catchError((err) => {
        return of({ res: { code: 404, message: err.message } });
      }),
    );
  },
  { concurrent: QUERY_CONCURRENCY },
);
