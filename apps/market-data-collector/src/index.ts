import { formatTime } from '@yuants/data-model';
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
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
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
  /** disable this relation (false equivalent to not set before) */
  disabled?: boolean;
  /** default to 0, means start from the latest period, above 0 means pull start from earlier periods */
  replay_count?: number;
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
  required: ['datasource_id', 'product_id', 'period_in_sec', 'cron_pattern', 'cron_timezone'],
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
    replay_count: {
      type: 'number',
      title: 'Replay Count',
    },
    disabled: {
      type: 'boolean',
      title: 'Disable this relation',
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
  term.queryDataRecords<IPullSourceRelation>({
    type: 'pull_source_relation',
  }),
)
  .pipe(
    //
    mergeMap((dataRecord) => {
      const config = dataRecord.origin;
      if (!validate(config)) {
        console.error(
          formatTime(Date.now()),
          `InvalidConfig`,
          `${config.datasource_id}:${config.product_id}:${config.period_in_sec}: ${ajv.errorsText(
            validate.errors,
          )}`,
        );
        return EMPTY;
      }
      return of(config);
    }),
    filter((v) => !v.disabled),
    toArray(),
    retry({ delay: 5_000 }),
    // ISSUE: to enlighten Storage Workload
    repeat({ delay: 30_000 }),
    batchGroupBy((config) => `${config.datasource_id}:${config.product_id}:${config.period_in_sec}`),
    mergeMap((group) =>
      group.pipe(
        //
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap((config) => {
          console.info(formatTime(Date.now()), `DetectConfigurationChange: ${JSON.stringify(config)}`);
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
              runOnInit: true,
            });
            return () => job.stop();
          }).pipe(
            //
            tap({
              unsubscribe: () => {
                console.info(formatTime(Date.now()), `StopSyncing: ${JSON.stringify(task)}`);
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
                MetricCronjobStatus.set(1, {
                  status: 'success',
                  datasource_id: task.datasource_id,
                  product_id: task.product_id,
                  period_in_sec: '' + task.period_in_sec,
                });
              },
            }),
            tap({
              subscribe: () => {
                console.info(formatTime(Date.now()), `StartSyncing: ${JSON.stringify(task)}`);
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
                MetricCronjobStatus.set(0, {
                  status: 'success',
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
                    console.info(formatTime(Date.now()), `EvaluateParams, config: ${JSON.stringify(task)}`);
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
                    MetricCronjobStatus.set(0, {
                      status: 'success',
                      datasource_id: task.datasource_id,
                      product_id: task.product_id,
                      period_in_sec: '' + task.period_in_sec,
                    });
                  }),
                  mergeMap(() =>
                    term.queryDataRecords<IPeriod>({
                      type: 'period',
                      tags: {
                        datasource_id: task.datasource_id,
                        product_id: task.product_id,
                        period_in_sec: '' + task.period_in_sec,
                      },
                      options: {
                        skip: task.replay_count || 0,
                        sort: [['frozen_at', -1]],
                        limit: 1,
                      },
                    }),
                  ),
                  map((v) => v.frozen_at),
                  filter((v): v is Exclude<typeof v, null> => !!v),
                  defaultIfEmpty(0),
                  first(),
                  mergeMap((lastTime) => {
                    if (Date.now() - lastTime < task.period_in_sec * 1000) {
                      console.info(new Date(), `SkipPullData, last pull time: ${new Date(lastTime)}`);
                      return EMPTY;
                    }
                    let startTime: number;
                    return defer(() => {
                      console.info(
                        formatTime(Date.now()),
                        `StartsToPullData, last pull time: ${new Date(
                          lastTime,
                        )}, range: [${lastTime}, ${Date.now()}]`,
                        `config: ${JSON.stringify(task)}`,
                      );
                      startTime = Date.now();
                      return term.terminalInfos$.pipe(
                        //
                        mergeMap((infos) =>
                          from(infos).pipe(
                            //
                            mergeMap((info) => {
                              if (
                                (info.services || []).find(
                                  (service) => service.datasource_id === task.datasource_id,
                                )
                              ) {
                                return of(info.terminal_id);
                              }
                              return EMPTY;
                            }),
                          ),
                        ),
                        first(),
                        mergeMap((target_terminal_id) =>
                          term.copyDataRecords(
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
                            target_terminal_id,
                          ),
                        ),
                      );
                    }).pipe(
                      //
                      tap(() => {
                        console.info(formatTime(Date.now()), `CompletePullData: ${group.key}`);
                        MetricPullSourceBucket.observe(Date.now() - startTime, {
                          status: 'success',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
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
                        MetricCronjobStatus.set(1, {
                          status: 'success',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
                      }),
                      map(() => ({ ...task, state: 'success' })),
                      catchError((err) => {
                        console.error(formatTime(Date.now()), `Task: ${group.key} Failed`, `${err}`);
                        MetricPullSourceBucket.observe(Date.now() - startTime, {
                          status: 'error',
                          datasource_id: task.datasource_id,
                          product_id: task.product_id,
                          period_in_sec: '' + task.period_in_sec,
                        });
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
                        MetricCronjobStatus.set(0, {
                          status: 'success',
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
