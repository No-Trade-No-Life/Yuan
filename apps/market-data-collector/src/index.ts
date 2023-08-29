import { IPeriod, PromRegistry, Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import Ajv from 'ajv';
import CronJob from 'cron';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  catchError,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  first,
  map,
  mergeMap,
  repeat,
  retry,
  switchMap,
  tap,
  timeout,
  toArray,
} from 'rxjs';

interface IPullSourceRelation {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
  /** Pattern of CronJob */
  cron_pattern: string;
  /** Timezone for CronJob evaluation */
  cron_timezone: string;
  /** Timeout (in ms) */
  timeout: number;
  /** Retry times (defaults to 0 - no retry) */
  retry_times: number;
}

const MetricPullSourceBucket = PromRegistry.create(
  'histogram',
  'market_data_collector_pull_source',
  'historical market data collector pull_source',
  [100, 1000, 10000, 30000, 60000, 300000],
);

const MetricCronjobStatus = PromRegistry.create(
  'gauge',
  'market_data_collector_cronjob_status',
  'historical market data CronJob status',
);

const schema: JSONSchema7 = {
  type: 'object',
  title: '历史行情数据同步者配置',
  properties: {
    datasource_id: {
      type: 'string',
      title: 'Datasource ID',
    },
    product_id: {
      type: 'string',
      title: 'Product ID',
    },
    period_in_sec: {
      type: 'number',
      title: 'duration (in seconds)',
    },
    cron_pattern: {
      type: 'string',
      title: 'Pattern of CronJob: when to pull data',
    },
    cron_timezone: {
      type: 'string',
      title: 'Timezone of CronJob',
    },
    timeout: {
      type: 'number',
      title: 'Timeout (in ms)',
    },
    retry_times: {
      type: 'number',
      title: 'Retry Times (defaults to 0 - no retry)',
    },
  },
};
const ajv = new Ajv();
const validate = ajv.compile(schema);

const HV_URL = process.env.HV_URL!;
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;
const TERMINAL_ID = process.env.TERMINAL_ID || 'DataCollector/history-market-data';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Historical Market Data Collector',
  status: 'OK',
});

defer(() =>
  term.queryDataRecords<IPullSourceRelation>(
    {
      type: 'pull_source_relation',
    },
    STORAGE_TERMINAL_ID,
  ),
)
  .pipe(
    //
    map((dataRecord) => {
      const config = dataRecord.origin;
      if (!validate(config)) {
        throw `Invalid config file: ${ajv.errorsText(validate.errors)}`;
      }
      return config;
    }),
    toArray(),
    repeat({ delay: 5000 }),
    batchGroupBy((config) => `${config.datasource_id}:${config.product_id}:${config.period_in_sec}`),
    mergeMap((group) =>
      group.pipe(
        //
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap((config) => {
          console.info(new Date(), `DetectConfigurationChange: ${JSON.stringify(config)}`);
        }),
        switchMapWithComplete((config) =>
          new Observable<IPullSourceRelation>((subscriber) => {
            const job = new CronJob.CronJob({
              cronTime: config.cron_pattern,
              onTick: () => {
                subscriber.next(config);
              },
              start: true,
              timeZone: config.cron_timezone,
            });
            return () => job.stop();
          }).pipe(
            //
            tap({
              unsubscribe: () => {
                console.info(new Date(), `StopSyncing: ${JSON.stringify(config)}`);
                MetricCronjobStatus.set(0, {
                  status: 'running',
                  datasource_id: config.datasource_id,
                  product_id: config.product_id,
                  period_in_sec: '' + config.period_in_sec,
                });
                MetricCronjobStatus.set(0, {
                  status: 'error',
                  datasource_id: config.datasource_id,
                  product_id: config.product_id,
                  period_in_sec: '' + config.period_in_sec,
                });
              },
            }),
            tap({
              subscribe: () => {
                console.info(new Date(), `StartSyncing: ${JSON.stringify(config)}`);
                MetricCronjobStatus.set(1, {
                  status: 'running',
                  datasource_id: config.datasource_id,
                  product_id: config.product_id,
                  period_in_sec: '' + config.period_in_sec,
                });
              },
            }),
          ),
        ),
        switchMap((config) =>
          defer(() => {
            console.info(new Date(), `EvaluateParams, config: ${JSON.stringify(config)}`);
            return term.queryDataRecords<IPeriod>(
              {
                type: 'period',
                tags: {
                  datasource_id: config.datasource_id,
                  product_id: config.product_id,
                  period_in_sec: '' + config.period_in_sec,
                },
                options: {
                  sort: [['frozen_at', -1]],
                  limit: 1,
                },
              },
              STORAGE_TERMINAL_ID,
            );
          }).pipe(
            //
            map((v) => v.frozen_at),
            filter((v): v is Exclude<typeof v, null> => !!v),
            defaultIfEmpty(0),
            first(),
            mergeMap((lastTime) => {
              let startTime: number;
              return defer(() => {
                console.info(
                  new Date(),
                  `StartsToPullData, last pull time: ${new Date(
                    lastTime,
                  )}, range: [${lastTime}, ${Date.now()}]`,
                  `config: ${JSON.stringify(config)}`,
                );
                startTime = Date.now();
                return term.queryPeriods(
                  {
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: config.period_in_sec,
                    start_time_in_us: lastTime * 1000,
                    end_time_in_us: Date.now() * 1000,
                    pull_source: true,
                  },
                  STORAGE_TERMINAL_ID,
                );
              }).pipe(
                //
                tap((data) => {
                  console.info(new Date(), `CompletePullData: ${group.key}, Total: ${data.length}`);
                  MetricPullSourceBucket.observe(Date.now() - startTime, {
                    status: 'success',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                  MetricCronjobStatus.set(1, {
                    status: 'running',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                  MetricCronjobStatus.set(0, {
                    status: 'error',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                }),
                timeout(config.timeout),
                catchError((err) => {
                  console.error(new Date(), `FailedPullData: ${group.key}`, err);
                  MetricPullSourceBucket.observe(Date.now() - startTime, {
                    status: 'error',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                  throw err;
                }),
                retry(config.retry_times),
                catchError((err) => {
                  console.error(new Date(), `任务：${group.key} 失败`, err);
                  MetricCronjobStatus.set(0, {
                    status: 'running',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                  MetricCronjobStatus.set(1, {
                    status: 'error',
                    datasource_id: config.datasource_id,
                    product_id: config.product_id,
                    period_in_sec: '' + config.period_in_sec,
                  });
                  return EMPTY;
                }),
              );
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();
