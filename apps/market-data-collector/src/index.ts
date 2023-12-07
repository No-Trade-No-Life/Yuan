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
  filter,
  first,
  from,
  interval,
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
const TERMINAL_ID = process.env.TERMINAL_ID || 'HistoricalMarketDataCollector';

const term = new Terminal(HV_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Historical Market Data Collector',
  status: 'OK',
});

const listWatch = <T, K>(
  list$: Observable<T[]>,
  hashKey: (config: T) => string,
  consumer: (config: T) => Observable<K>,
) =>
  list$.pipe(
    batchGroupBy(hashKey),
    mergeMap((group) => group.pipe(switchMapWithComplete(consumer))),
  );

listWatch(
  defer(() =>
    term.queryDataRecords<IPullSourceRelation>({
      type: 'pull_source_relation',
    }),
  ).pipe(
    //
    map((x) => x.origin),
    toArray(),
    retry({ delay: 5_000 }),
    // ISSUE: to enlighten Storage Workload
    repeat({ delay: 30_000 }),
  ),
  (config) => JSON.stringify(config),
  (task) => runTask(task),
).subscribe();

const fromCronJob = (options: Omit<CronJob.CronJobParameters, 'onTick' | 'start'>) =>
  new Observable((subscriber) => {
    const sub = new CronJob.CronJob({
      ...options,
      onTick: () => {
        subscriber.next();
      },
      start: true,
    });
    return () => {
      sub.stop();
    };
  });

const validate = ajv.compile(schema);
const runTask = (psr: IPullSourceRelation) =>
  new Observable((subscriber) => {
    if (psr.disabled) return;
    const title = JSON.stringify(psr);
    if (!validate(psr)) {
      console.error(formatTime(Date.now()), `InvalidConfig`, `${title}: ${ajv.errorsText(validate.errors)}`);
      return;
    }

    console.info(formatTime(Date.now()), `StartSyncing: ${title}`);

    const taskStartAction$ = new Subject<void>();
    const getLastTimeAction$ = new Subject<void>();
    const copyDataAction$ = new Subject<number>();
    const copyDataComplete$ = new Subject<void>();
    const copyDataError$ = new Subject<any>();
    const copyDataFinalize$ = new Subject<void>();

    /**
     * State of the task
     * - `running`: task is loading
     * - `error`: task is failed
     * - `success`: task is completed
     */
    let state: string = 'success';
    /**
     * Current backOff time (in ms)
     * task behaves like a pod of k8s, when it is failed, it enters crashLoopBackOff state,
     * each time it will wait for a certain amount of time before retrying,
     * this wait time is increased linearly until it reaches 5min
     */
    let current_back_off_time: number = 0;
    let started_at = 0;
    let completed_at = 0;

    const subs: Subscription[] = [];

    subs.push(
      fromCronJob({ cronTime: psr.cron_pattern, timeZone: psr.cron_timezone }).subscribe(() => {
        if (state === 'success') {
          taskStartAction$.next();
        }
      }),
    );

    // Log
    subs.push(
      taskStartAction$.subscribe(() => {
        console.info(formatTime(Date.now()), `TaskStart, config: ${title}`);
      }),
    );

    const reportState = () => {
      const tags = {
        datasource_id: psr.datasource_id,
        product_id: psr.product_id,
        period_in_sec: '' + psr.period_in_sec,
      };
      for (const s of ['running', 'error', 'success']) {
        MetricCronjobStatus.set(state === s ? 1 : 0, {
          ...tags,
          status: s,
        });
      }
    };

    // Metrics State
    subs.push(interval(1000).subscribe(reportState));

    // Wait for current_back_off_time to start
    subs.push(
      taskStartAction$.subscribe(() => {
        timer(current_back_off_time).subscribe(() => {
          getLastTimeAction$.next();
        });
      }),
    );

    // Fetch Last Updated Period
    subs.push(
      getLastTimeAction$.subscribe(() => {
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
            // ISSUE: prevent from data leak
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
            copyDataAction$.next(lastTime);
          });
      }),
    );

    // Log
    subs.push(
      copyDataAction$.subscribe((lastTime) => {
        console.info(
          formatTime(Date.now()),
          `StartsToCopyData, last copied time: ${new Date(lastTime)}, range: [${lastTime}, ${Date.now()}]`,
          `config: ${title}`,
        );
      }),
    );

    subs.push(
      copyDataAction$.subscribe(() => {
        started_at = Date.now();
      }),
    );

    subs.push(
      copyDataAction$
        .pipe(
          mergeMap((lastTime) =>
            term.terminalInfos$.pipe(
              //
              mergeMap((infos) =>
                from(infos).pipe(
                  //
                  mergeMap((info) => {
                    if (
                      (info.services || []).find((service) => service.datasource_id === psr.datasource_id)
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
              tap(() => {
                copyDataComplete$.next();
              }),
              catchError((err, caught$) => {
                copyDataError$.next(err);
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe(),
    );

    subs.push(
      copyDataComplete$.subscribe(() => {
        state = 'success';
        completed_at = Date.now();
        console.info(formatTime(Date.now()), `CompletePullData: ${title}`);
        copyDataFinalize$.next();
      }),
    );

    subs.push(
      copyDataError$.subscribe((err) => {
        state = 'error';
        completed_at = Date.now();
        // at most 5min
        current_back_off_time = Math.min(current_back_off_time + 10_000, 300_000);
        console.error(formatTime(Date.now()), `Task: ${title} Failed`, `${err}`);
        copyDataFinalize$.next();
      }),
    );

    // Metrics Latency
    subs.push(
      copyDataFinalize$.subscribe(() => {
        MetricPullSourceBucket.observe(completed_at - started_at, {
          status: state,
          datasource_id: psr.datasource_id,
          product_id: psr.product_id,
          period_in_sec: '' + psr.period_in_sec,
        });
      }),
    );

    // Retry Task if error
    subs.push(
      copyDataFinalize$.subscribe(() => {
        if (state === 'error') {
          taskStartAction$.next();
        }
      }),
    );

    return () => {
      console.info(formatTime(Date.now()), `StopSyncing: ${title}`);
      reportState();
      subs.forEach((sub) => sub.unsubscribe());
    };
  });
