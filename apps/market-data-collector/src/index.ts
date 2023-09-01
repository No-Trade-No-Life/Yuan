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
  expand,
  filter,
  first,
  map,
  mergeMap,
  of,
  repeat,
  switchMap,
  tap,
  timer,
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
}

interface ITask extends IPullSourceRelation {
  /**
   * State of the task
   * - `running`: task is running
   * - `error`: task is failed
   * - `success`: task is completed
   */
  state: string;
  /**
   * Current backOff time (in ms)
   * task behaves like a pod of k8s, when it is failed, it enters crashLoopBackOff state,
   * each time it will wait for a certain amount of time before retrying,
   * this wait time is increased linearly until it reaches 5min
   */
  current_backOff_time: number;
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
  title: 'Historical Market Data Collector Config',
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
        switchMapWithComplete((task) =>
          new Observable<ITask>((subscriber) => {
            const job = new CronJob.CronJob({
              cronTime: task.cron_pattern,
              onTick: () => {
                subscriber.next({ ...task, state: 'running', current_backOff_time: 0 });
              },
              start: true,
              timeZone: task.cron_timezone,
            });
            return () => job.stop();
          }).pipe(
            //
            tap({
              unsubscribe: () => {
                console.info(new Date(), `StopSyncing: ${JSON.stringify(task)}`);
                MetricCronjobStatus.set(0, {
                  status: 'running',
                  datasource_id: task.datasource_id,
                  product_id: task.product_id,
                  period_in_sec: '' + task.period_in_sec,
                });
                MetricCronjobStatus.set(0, {
                  status: 'error',
                  datasource_id: task.datasource_id,
                  product_id: task.product_id,
                  period_in_sec: '' + task.period_in_sec,
                });
              },
            }),
            tap({
              subscribe: () => {
                console.info(new Date(), `StartSyncing: ${JSON.stringify(task)}`);
                MetricCronjobStatus.set(1, {
                  status: 'running',
                  datasource_id: task.datasource_id,
                  product_id: task.product_id,
                  period_in_sec: '' + task.period_in_sec,
                });
              },
            }),
          ),
        ),
        switchMap((task) =>
          of(task).pipe(
            //
            expand((task) => {
              if (task.state === 'success') {
                return EMPTY;
              } else {
                return timer(task.current_backOff_time).pipe(
                  //
                  tap(() => {
                    console.info(new Date(), `EvaluateParams, config: ${JSON.stringify(task)}`);
                    MetricCronjobStatus.set(1, {
                      status: 'running',
                      datasource_id: task.datasource_id,
                      product_id: task.product_id,
                      period_in_sec: '' + task.period_in_sec,
                    });
                    MetricCronjobStatus.set(0, {
                      status: 'error',
                      datasource_id: task.datasource_id,
                      product_id: task.product_id,
                      period_in_sec: '' + task.period_in_sec,
                    });
                  }),
                  mergeMap(() =>
                    term.queryDataRecords<IPeriod>(
                      {
                        type: 'period',
                        tags: {
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        },
                        options: {
                          sort: [['frozen_at', -1]],
                          limit: 1,
                        },
                      },
                      STORAGE_TERMINAL_ID,
                    ),
                  ),
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
                        `config: ${JSON.stringify(task)}`,
                      );
                      startTime = Date.now();
                      return term.copyDataRecords(
                        {
                          type: 'period',
                          tags: {
                            datasource_id: task.datasource_id,
                            product_id: task.product_id,
                            period_in_sec: '' + task.period_in_sec,
                          },
                          time_range: [lastTime, Date.now()],
                          receiver_terminal_id: STORAGE_TERMINAL_ID,
                        },
                        STORAGE_TERMINAL_ID,
                      );
                    }).pipe(
                      //
                      tap(() => {
                        console.info(new Date(), `CompletePullData: ${group.key}`);
                        MetricPullSourceBucket.observe(Date.now() - startTime, {
                          status: 'success',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
                      }),
                      map(() => ({ ...task, state: 'success' })),
                      catchError((err) => {
                        console.error(new Date(), `FailedPullData: ${group.key}`, err);
                        MetricPullSourceBucket.observe(Date.now() - startTime, {
                          status: 'error',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
                        console.error(new Date(), `Task: ${group.key} Failed`, err);
                        MetricCronjobStatus.set(0, {
                          status: 'running',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
                        MetricCronjobStatus.set(1, {
                          status: 'error',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
                        return of({
                          ...task,
                          state: 'error',
                          // at most 5min
                          current_backOff_time: Math.min(task.current_backOff_time + 10_000, 300_000),
                        });
                      }),
                    );
                  }),
                );
              }
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();
