import { IDataRecordTypes, formatTime, getDataRecordSchema } from '@yuants/data-model';
import { PromRegistry, Terminal, copyDataRecords, queryDataRecords } from '@yuants/protocol';
import { batchGroupBy, listWatch, switchMapWithComplete } from '@yuants/utils';
import Ajv from 'ajv';
import CronJob from 'cron';
import {
  EMPTY,
  Observable,
  OperatorFunction,
  Subject,
  Subscription,
  catchError,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  filter,
  first,
  interval,
  map,
  mergeMap,
  pipe,
  repeat,
  retry,
  tap,
  timer,
  toArray,
} from 'rxjs';

type ICopyDataRelation = IDataRecordTypes['copy_data_relation'];

const MetricDataCollectorLatencyMsBucket = PromRegistry.create(
  'histogram',
  'data_collector_latency_ms',
  'data collector',
  [100, 1000, 10000, 30000, 60000, 300000],
);

const MetricCronjobStatus = PromRegistry.create(
  'gauge',
  'data_collector_cronjob_status',
  'data CronJob status',
);

const ajv = new Ajv({ strict: false });

const HOST_URL = process.env.HOST_URL!;
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;
const TERMINAL_ID = process.env.TERMINAL_ID || 'DataCollector';

const term = new Terminal(HOST_URL, {
  terminal_id: TERMINAL_ID,
  name: 'Data Collector',
});

defer(() =>
  queryDataRecords<ICopyDataRelation>(term, {
    type: 'copy_data_relation',
  }),
)
  .pipe(
    //
    map((x) => x.origin),
    toArray(),
    retry({ delay: 5_000 }),
    // ISSUE: to enlighten Storage Workload
    repeat({ delay: 30_000 }),
  )
  .pipe(
    listWatch(
      (config) => JSON.stringify(config),
      (task) => runTask(task),
    ),
  )
  .subscribe();

const fromCronJob = (options: Omit<CronJob.CronJobParameters, 'onTick' | 'start'>) =>
  new Observable((subscriber) => {
    try {
      const job = new CronJob.CronJob({
        ...options,
        onTick: () => {
          subscriber.next();
        },
        start: true,
      });
      return () => {
        job.stop();
      };
    } catch (e) {
      subscriber.error(e);
    }
  });

const validate = ajv.compile(getDataRecordSchema('copy_data_relation')!);
const runTask = (cdr: ICopyDataRelation) =>
  new Observable<void>((subscriber) => {
    if (cdr.disabled) return;
    const title = JSON.stringify(cdr);
    if (!validate(cdr)) {
      console.error(formatTime(Date.now()), `InvalidConfig`, `${ajv.errorsText(validate.errors)}`, title);
      return;
    }

    console.info(formatTime(Date.now()), `StartSyncing`, title);

    const taskScheduled$ = new Subject<void>();
    const taskStart$ = new Subject<void>();
    const copyDataAction$ = new Subject<void>();
    const taskComplete$ = new Subject<void>();
    const taskError$ = new Subject<void>();
    const taskFinalize$ = new Subject<void>();

    /**
     * State of the task
     * - `running`: task is loading
     * - `error`: task is failed
     * - `success`: task is completed
     */
    let status: string = 'success';
    /**
     * Current backOff time (in ms)
     * task behaves like a pod of k8s, when it is failed, it enters crashLoopBackOff state,
     * each time it will wait for a certain amount of time before retrying,
     * this wait time is increased linearly until it reaches 5min
     */
    let current_back_off_time: number = 0;
    let started_at = 0;
    let completed_at = 0;
    let lastTime = 0;
    let err: any;

    const subs: Subscription[] = [];

    subs.push(
      fromCronJob({ cronTime: cdr.cron_pattern, timeZone: cdr.cron_timezone }).subscribe({
        next: () => {
          if (status === 'success') {
            taskScheduled$.next();
          }
        },
        error: (e) => {
          status = 'error';
          console.error(formatTime(Date.now()), `TaskConfigError`, JSON.stringify(cdr), `${e}`);
        },
      }),
    );

    // Log
    subs.push(
      taskScheduled$.subscribe(() => {
        console.info(formatTime(Date.now()), `TaskScheduled`, title);
      }),
    );

    const reportStatus = () => {
      for (const s of ['running', 'error', 'success']) {
        MetricCronjobStatus.set(status === s ? 1 : 0, {
          series_id: cdr.series_id,
          status: s,
        });
      }
    };

    // Metrics State
    subs.push(interval(10_000).subscribe(reportStatus));

    // Wait for current_back_off_time to start
    subs.push(
      taskScheduled$.subscribe(() => {
        if (status !== 'running') {
          status = 'running';
          taskStart$.next();
        }
      }),
    );

    // Log
    subs.push(
      taskStart$.subscribe(() => {
        console.info(formatTime(Date.now()), `TaskStarted`, title);
      }),
    );

    // Fetch Last Updated Data record
    subs.push(
      taskStart$.subscribe(() => {
        defer(() =>
          queryDataRecords(term, {
            type: cdr.type,
            tags: {
              series_id: cdr.series_id,
            },
            options: {
              skip: cdr.replay_count || 0,
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
            filter((v): v is Exclude<typeof v, null | undefined> => !!v),
            defaultIfEmpty(0),
            first(),
          )
          .subscribe((t) => {
            lastTime = t;
            copyDataAction$.next();
          });
      }),
    );

    // Log
    subs.push(
      copyDataAction$.subscribe(() => {
        console.info(formatTime(Date.now()), `StartsToCopyData`, `from=${formatTime(lastTime)}`, title);
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
          mergeMap(() =>
            defer(() =>
              copyDataRecords(term, {
                type: cdr.type,
                tags: {
                  series_id: cdr.series_id,
                },
                time_range: [lastTime, Date.now()],
                receiver_terminal_id: STORAGE_TERMINAL_ID,
              }),
            ).pipe(
              tap(() => {
                taskComplete$.next();
              }),
              // ISSUE: catch error will replace the whole stream with EMPTY, therefore it must be placed inside mergeMap
              // so that the outer stream subscription will not be affected
              catchError((e) => {
                err = e;
                taskError$.next();
                return EMPTY;
              }),
            ),
          ),
        )
        .subscribe(),
    );

    subs.push(
      taskComplete$.subscribe(() => {
        status = 'success';
        completed_at = Date.now();
        current_back_off_time = 0; // reset
        console.info(formatTime(Date.now()), `TaskComplete`, title);
        taskFinalize$.next();
      }),
    );

    subs.push(
      taskError$.subscribe(() => {
        status = 'error';
        completed_at = Date.now();
        // at most 5min
        current_back_off_time = Math.min(current_back_off_time + 10_000, 300_000);
        console.error(formatTime(Date.now()), `TaskError`, `${err}`, title);
        taskFinalize$.next();
      }),
    );

    // Metrics Latency
    subs.push(
      taskFinalize$.subscribe(() => {
        MetricDataCollectorLatencyMsBucket.observe(completed_at - started_at, {
          status: status,
          series_id: cdr.series_id,
        });
      }),
    );

    // Retry Task if error
    subs.push(
      taskFinalize$.subscribe(() => {
        if (status === 'error') {
          console.info(formatTime(Date.now()), `TaskRetry`, title);
          timer(current_back_off_time).subscribe(() => {
            taskScheduled$.next();
          });
        }
      }),
    );

    return () => {
      console.info(formatTime(Date.now()), `StopSyncing`, title);
      reportStatus();
      subs.forEach((sub) => sub.unsubscribe());
    };
  });
