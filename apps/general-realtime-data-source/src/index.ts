import { encodePath, formatTime } from '@yuants/data-model';
import { IPeriod, Terminal } from '@yuants/protocol';
import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  combineLatest,
  defer,
  first,
  from,
  groupBy,
  map,
  mergeMap,
  of,
  repeat,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';

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
const TERMINAL_ID = process.env.TERMINAL_ID || 'GeneralRealtimeDataSource';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'General Data Source',
  status: 'OK',
});

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

const subscribePeriods = (product_id: string, period_in_sec: number) => {
  return mapProductIdToGSRList$.pipe(
    first(),
    mergeMap((mapProductIdToGSRList) => {
      const gsrList = mapProductIdToGSRList[product_id];
      if (!gsrList) {
        console.error(formatTime(Date.now()), `Cannot find gsrList for ${product_id}`);
        return EMPTY;
      }
      return of(gsrList);
    }),
    mergeMap((gsrList) =>
      from(gsrList).pipe(
        map((gsr) =>
          term.consumeChannel<IPeriod[]>(
            encodePath('Period', gsr.specific_datasource_id, gsr.specific_product_id, period_in_sec),
          ),
        ),
        toArray(),
      ),
    ),
    mergeMap((v) => combineLatest(v)),
    map((v) => {
      const queues: IPeriod[][] = v;
      const results: IPeriod[] = [];
      while (queues.every((queue, i) => queue.length !== 0)) {
        const min = queues.reduce((acc, queue) => {
          if (acc === undefined) {
            return queue[0];
          }
          if (queue[0] === undefined) {
            return acc;
          }
          if (acc.timestamp_in_us < queue[0].timestamp_in_us) {
            return acc;
          } else {
            return queue[0];
          }
        }, queues[0][0]);

        if (min === undefined) {
          break;
        }
        const periods: IPeriod[] = [];
        for (let i = 0; i < queues.length; i++) {
          if (queues[i].length !== 0 && queues[i][0].timestamp_in_us === min.timestamp_in_us) {
            periods.push(queues[i].shift()!);
          }
        }
        results.push({
          datasource_id: 'Y',
          product_id: product_id,
          period_in_sec,
          timestamp_in_us: +periods[0].timestamp_in_us,
          open: periods.map((v) => v.open).reduce((acc, cur) => acc + cur, 0) / periods.length,
          high: periods.map((v) => v.high).reduce((acc, cur) => Math.max(acc, cur), -Infinity),
          low: periods.map((v) => v.low).reduce((acc, cur) => Math.min(acc, cur), Infinity),
          close: periods.map((v) => v.close).reduce((acc, cur) => acc + cur, 0) / periods.length,
          volume: periods.map((v) => v.volume).reduce((acc, cur) => acc + cur, 0) / periods.length,
        });
      }
      return results;
    }),
    tap((periods) => {
      console.info(
        formatTime(Date.now()),
        `SubscribePeriods`,
        JSON.stringify({
          product_id,
          period_in_sec,
          periods,
          length: periods.length,
        }),
      );
    }),
  );
};

const usePeriod = (() => {
  const hub: Record<string, Observable<IPeriod[]>> = {};
  return (product_id: string, period_in_sec: number) =>
    (hub[`${product_id}-${period_in_sec}`] ??= defer(() => subscribePeriods(product_id, period_in_sec)));
})();

term.providePeriods('Y', usePeriod);
