import { formatTime } from '@yuants/data-model';
import { IPeriod, PromRegistry, Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import Ajv from 'ajv';
import CronJob from 'cron';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  first,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
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

interface ITask {
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
  current_back_off_time: number;
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

const HV_URL = process.env.HV_URL!;
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;
const TERMINAL_ID = process.env.TERMINAL_ID || 'DataCollector/history-market-data';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Historical Market Data Collector',
  status: 'OK',
});

const listWatchConfigs = <T>(
  type: string,
  jsonSchema: JSONSchema7,
  groupKey: (config: T) => string,
  filterCondition: (config: T) => boolean = () => true,
) => {
  const validate = ajv.compile(jsonSchema);
  return defer(() =>
    term.queryDataRecords<T>({
      type,
    }),
  ).pipe(
    //
    mergeMap((dataRecord) => {
      const config = dataRecord.origin;
      if (!validate(config)) {
        console.error(
          formatTime(Date.now()),
          `InvalidConfig`,
          `${JSON.stringify(config)}: ${ajv.errorsText(validate.errors)}`,
        );
        return EMPTY;
      }
      return of(config);
    }),
    filter(filterCondition),
    toArray(),
    retry({ delay: 5_000 }),
    // ISSUE: to enlighten Storage Workload
    repeat({ delay: 30_000 }),
    batchGroupBy(groupKey),
    map((group): Observable<T> & { key: string } => {
      const filtered = group.pipe(
        //
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        tap((config) => {
          console.info(formatTime(Date.now()), `DetectConfigurationChange: ${JSON.stringify(config)}`);
        }),
      );
      return Object.assign(filtered, { key: group.key });
    }),
  );
};

const config$ = listWatchConfigs(
  'pull_source_relation',
  schema,
  (config: IPullSourceRelation) => `${config.datasource_id}:${config.product_id}:${config.period_in_sec}`,
  (config) => !config.disabled,
);

const configEvent$ = new Subject<{
  psr: IPullSourceRelation;
  event: 'upsert' | 'delete';
}>();

config$
  .pipe(
    //
    mergeMap((group) =>
      group.pipe(
        //
        switchMapWithComplete((task) =>
          of(task).pipe(
            tap({
              subscribe: () => {
                configEvent$.next({ psr: task, event: 'upsert' });
              },
              unsubscribe: () => {
                configEvent$.next({ psr: task, event: 'delete' });
              },
            }),
          ),
        ),
      ),
    ),
  )
  .subscribe();

// For GC
const mapKeyToCron: Record<string, CronJob.CronJob> = {};
const mapKeyToSubscriptions: Record<string, Subscription[]> = {};

const mapKeyToTask: Record<string, ITask> = {};
configEvent$.subscribe(({ psr, event }) => {
  const key = `${psr.datasource_id}:${psr.product_id}:${psr.period_in_sec}`;
  if (event === 'upsert') {
    if (mapKeyToSubscriptions[key]) {
      mapKeyToSubscriptions[key].forEach((subscription) => subscription.unsubscribe());
    }
    if (mapKeyToCron[key]) {
      mapKeyToCron[key].stop();
    }
    console.info(formatTime(Date.now()), `StartSyncing: ${JSON.stringify(psr)}`);
    MetricCronjobStatus.set(1, {
      status: 'running',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });
    MetricCronjobStatus.set(0, {
      status: 'error',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });
    MetricCronjobStatus.set(0, {
      status: 'success',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });

    const taskStartAction = new Subject<void>();
    const getLastTimeAction = new Subject<void>();
    const copyDataAction = new Subject<number>();
    const taskStopAction = new Subject<number>();

    const subs: Subscription[] = [];
    mapKeyToSubscriptions[key] = subs;

    mapKeyToCron[key] = new CronJob.CronJob({
      cronTime: psr.cron_pattern,
      onTick: () => {
        taskStartAction.next();
      },
      start: true,
      timeZone: psr.cron_timezone,
    });

    subs.push(
      taskStartAction.subscribe(() => {
        console.info(formatTime(Date.now()), `EvaluateParams, config: ${JSON.stringify(psr)}`);
        MetricCronjobStatus.set(1, {
          status: 'running',
          datasource_id: psr.datasource_id,
          product_id: psr.product_id,
          period_in_sec: '' + psr.period_in_sec,
        });
        MetricCronjobStatus.set(0, {
          status: 'error',
          datasource_id: psr.datasource_id,
          product_id: psr.product_id,
          period_in_sec: '' + psr.period_in_sec,
        });
        MetricCronjobStatus.set(0, {
          status: 'success',
          datasource_id: psr.datasource_id,
          product_id: psr.product_id,
          period_in_sec: '' + psr.period_in_sec,
        });
      }),
    );
    subs.push(
      taskStartAction.subscribe(() => {
        const task = mapKeyToTask[key];
        timer(task.current_back_off_time).subscribe(() => {
          getLastTimeAction.next();
        });
      }),
    );

    subs.push(
      getLastTimeAction.subscribe(() => {
        defer(() =>
          term.queryDataRecords<IPeriod>({
            type: 'period',
            tags: {
              datasource_id: psr.datasource_id,
              product_id: psr.product_id,
              period_in_sec: '' + psr.period_in_sec,
            },
            options: {
              skip: psr.replay_count || 0,
              sort: [['frozen_at', -1]],
              limit: 1,
            },
          }),
        )
          .pipe(
            //
            toArray(),
            retry({ delay: 5_000 }),
            mergeMap((v) => v),
          )
          .pipe(
            //
            map((v) => v.frozen_at),
            filter((v): v is Exclude<typeof v, null> => !!v),
            defaultIfEmpty(0),
            first(),
          )
          .subscribe((lastTime) => {
            copyDataAction.next(lastTime);
          });
      }),
    );

    subs.push(
      copyDataAction.subscribe((lastTime) => {
        let startTime: number;
        defer(() => {
          console.info(
            formatTime(Date.now()),
            `StartsToPullData, last pull time: ${new Date(lastTime)}, range: [${lastTime}, ${Date.now()}]`,
            `config: ${JSON.stringify(psr)}`,
          );
          startTime = Date.now();
          return term.terminalInfos$.pipe(
            //
            mergeMap((infos) =>
              from(infos).pipe(
                //
                mergeMap((info) => {
                  if ((info.services || []).find((service) => service.datasource_id === psr.datasource_id)) {
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
                    datasource_id: psr.datasource_id,
                    product_id: psr.product_id,
                    period_in_sec: '' + psr.period_in_sec,
                  },
                  time_range: [lastTime, Date.now()],
                  receiver_terminal_id: STORAGE_TERMINAL_ID,
                },
                target_terminal_id,
              ),
            ),
            map(() => Date.now() - startTime),
            tap(() => {
              console.info(formatTime(Date.now()), `CompletePullData: ${key}`);
              const task = mapKeyToTask[key];
              mapKeyToTask[key] = {
                ...task,
                state: 'success',
              };
            }),
            catchError((err) => {
              const task = mapKeyToTask[key];
              mapKeyToTask[key] = {
                state: 'error',
                // at most 5min
                current_back_off_time: Math.min(task.current_back_off_time + 10_000, 300_000),
              };
              console.error(formatTime(Date.now()), `Task: ${key} Failed`, `${err}`);
              return of(Date.now() - startTime);
            }),
          );
        }).subscribe((duration) => {
          taskStopAction.next(duration);
        });
      }),
    );

    subs.push(
      taskStopAction.subscribe((duration) => {
        const task = mapKeyToTask[key];
        if (task.state === 'success') {
          MetricPullSourceBucket.observe(duration, {
            status: 'success',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(0, {
            status: 'running',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(0, {
            status: 'error',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(1, {
            status: 'success',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
        } else {
          MetricPullSourceBucket.observe(duration, {
            status: 'error',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(0, {
            status: 'running',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(1, {
            status: 'error',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          MetricCronjobStatus.set(0, {
            status: 'success',
            datasource_id: psr.datasource_id,
            product_id: psr.product_id,
            period_in_sec: '' + psr.period_in_sec,
          });
          taskStartAction.next();
        }
      }),
    );
  }
  if (event === 'delete') {
    console.info(formatTime(Date.now()), `StopSyncing: ${JSON.stringify(psr)}`);
    MetricCronjobStatus.set(0, {
      status: 'running',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });
    MetricCronjobStatus.set(0, {
      status: 'error',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });
    MetricCronjobStatus.set(1, {
      status: 'success',
      datasource_id: psr.datasource_id,
      product_id: psr.product_id,
      period_in_sec: '' + psr.period_in_sec,
    });
    if (mapKeyToCron[key]) {
      mapKeyToCron[key].stop();
    }
    if (mapKeyToSubscriptions[key]) {
      mapKeyToSubscriptions[key].forEach((subscription) => subscription.unsubscribe());
    }
    delete mapKeyToSubscriptions[key];
    delete mapKeyToCron[key];
    delete mapKeyToTask[key];
  }
});
