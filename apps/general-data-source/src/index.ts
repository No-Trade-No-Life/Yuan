import { IDataRecordTypes, IPeriod, decodePath, getDataRecordSchema } from '@yuants/data-model';
import { provideDataSeries } from '@yuants/data-series';
import { PromRegistry, Terminal, readDataRecords } from '@yuants/protocol';
import Ajv from 'ajv';
import {
  EMPTY,
  Observable,
  catchError,
  defer,
  firstValueFrom,
  from,
  groupBy,
  map,
  mergeAll,
  mergeMap,
  repeat,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';
import { mergeSort } from './utils';

type IGeneralSpecificRelation = IDataRecordTypes['general_specific_relation'];

const MetricSyncDurationBucket = PromRegistry.create('histogram', 'general_data_source_sync_duration_bucket');

const MetricSyncStatus = PromRegistry.create('gauge', 'general_data_source_sync_status');

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(getDataRecordSchema('general_specific_relation')!);

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
        readDataRecords(term, {
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
        mergeAll(),
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
  readDataRecords(term, {
    type: 'general_specific_relation',
  }),
).pipe(
  //
  mergeAll(),
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

provideDataSeries(term, {
  type: 'period',
  series_id_prefix_parts: ['Y'],
  reversed: false,
  serviceOptions: { concurrent: QUERY_CONCURRENCY },
  queryFn: async function ({ series_id, started_at, ended_at }) {
    const [datasource_id, product_id, _period_in_sec] = decodePath(series_id);
    const period_in_sec = +_period_in_sec;
    if (!datasource_id) {
      throw 'datasource_id is required';
    }
    if (!product_id) {
      throw 'product_id is required';
    }
    if (!period_in_sec) {
      throw 'period_in_sec is required';
    }

    const mapProductIdToGSRList = await firstValueFrom(mapProductIdToGSRList$);
    const gsrList = mapProductIdToGSRList[product_id];
    if (!gsrList) {
      throw `product_id: ${product_id} 不存在`;
    }
    const periods = await firstValueFrom(
      syncData(product_id, +period_in_sec, gsrList, [started_at, ended_at]),
    );
    return periods;
  },
});
