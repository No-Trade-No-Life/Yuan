import '@yuants/data-series';
import { ISeriesCollectingTask } from '@yuants/data-series';
import { IService, PromRegistry, Terminal } from '@yuants/protocol';
import { escape, requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch } from '@yuants/utils';
import CronJob from 'cron';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defaultIfEmpty,
  defer,
  filter,
  first,
  interval,
  map,
  mergeAll,
  mergeMap,
  repeat,
  retry,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

const MetricDataCollectorLatencyMsBucket = PromRegistry.create('histogram', 'series_collector_latency_ms');
const MetricCronjobStatus = PromRegistry.create('gauge', 'series_collector_cronjob_status');

const terminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: process.env.TERMINAL_ID || 'SeriesCollector',
  name: '@yuants/series-collector',
});

interface ITaskContext {
  table_name: string;
  series_id: string;
  /**
   * State of the task
   * - `running`: task is loading
   * - `error`: task is failed
   * - `success`: task is completed
   */
  status: 'running' | 'error' | 'success';

  /**
   * Data record last created_at time
   */
  last_created_at: number;

  /**
   * Current backOff time (in ms)
   * task behaves like a pod of k8s, when it is failed, it enters crashLoopBackOff state,
   * each time it will wait for a certain amount of time before retrying,
   * this wait time is increased linearly until it reaches 5min
   */
  current_back_off_time: number;

  /** 启动时间 */
  started_at: number;
  /** 上次完成时间 */
  completed_at: number;

  api_status?: IService['CollectSeries']['frame'];

  error_message?: string;
}

const taskContexts = new Set<ITaskContext>();

defer(() =>
  requestSQL<ISeriesCollectingTask[]>(
    terminal,
    `
    select * from series_collecting_task
    where disabled = false
  `,
  ),
)
  .pipe(
    retry({ delay: 5_000 }),
    // ISSUE: to enlighten Storage Workload
    repeat({ delay: 30_000 }),
  )
  .pipe(
    listWatch(
      (config) => encodePath(config.table_name, config.series_id),
      (task) => runTask(task),
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
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

terminal.provideService('SeriesCollector/PeekTaskContext', {}, () => [
  { res: { code: 0, message: 'OK', data: [...taskContexts] } },
]);

const runTask = (task: ISeriesCollectingTask) =>
  new Observable<void>((subscriber) => {
    if (task.disabled) return;
    const title = JSON.stringify(task);

    console.info(formatTime(Date.now()), `StartSyncing`, title);

    const taskContext: ITaskContext = {
      table_name: task.table_name,
      series_id: task.series_id,
      status: 'success',
      last_created_at: 0,

      current_back_off_time: 0,
      started_at: 0,
      completed_at: 0,
    };

    taskContexts.add(taskContext);

    const taskScheduled$ = new Subject<void>();
    const taskStart$ = new Subject<void>();
    const collectSeriesAction$ = new Subject<void>();
    const taskComplete$ = new Subject<void>();
    const taskError$ = new Subject<void>();
    const taskFinalize$ = new Subject<void>();

    const dispose$ = new Subject<void>();

    fromCronJob({ cronTime: task.cron_pattern, timeZone: task.cron_timezone })
      .pipe(takeUntil(dispose$))
      .subscribe({
        next: () => {
          if (taskContext.status === 'success') {
            taskScheduled$.next();
          }
        },
        error: (e) => {
          taskContext.status = 'error';
          console.error(formatTime(Date.now()), `TaskConfigError`, JSON.stringify(task), `${e}`);
        },
      });

    // Log
    taskScheduled$.pipe(takeUntil(dispose$)).subscribe(() => {
      console.info(formatTime(Date.now()), `TaskScheduled`, title);
    });

    const reportStatus = () => {
      for (const s of ['running', 'error', 'success']) {
        MetricCronjobStatus.set(taskContext.status === s ? 1 : 0, {
          series_id: task.series_id,
          status: s,
        });
      }
    };

    // Metrics State
    interval(10_000).pipe(takeUntil(dispose$)).subscribe(reportStatus);

    // Wait for current_back_off_time to start
    taskScheduled$.pipe(takeUntil(dispose$)).subscribe(() => {
      if (taskContext.status !== 'running') {
        taskContext.status = 'running';
        taskStart$.next();
      }
    });

    // Log
    taskStart$.pipe(takeUntil(dispose$)).subscribe(() => {
      console.info(formatTime(Date.now()), `TaskStarted`, title);
    });

    // Fetch Last Updated Data record
    taskStart$.pipe(takeUntil(dispose$)).subscribe(() => {
      defer(() =>
        requestSQL<{ created_at: string }[]>(
          terminal,
          `
              select created_at from ${task.table_name}
              where series_id = ${escape(task.series_id)}
              order by created_at desc
              offset ${task.replay_count || 0}
              limit 1
          `,
        ),
      )
        .pipe(
          // ISSUE: prevent from data leak
          retry({ delay: 5_000 }),
          mergeAll(),
        )
        .pipe(
          //
          map((v) => new Date(v.created_at).getTime()),
          filter((v): v is Exclude<typeof v, null | undefined> => !!v),
          defaultIfEmpty(0),
          first(),
        )
        .subscribe((t) => {
          taskContext.last_created_at = t;
          collectSeriesAction$.next();
        });
    });

    // Log

    collectSeriesAction$.pipe(takeUntil(dispose$)).subscribe(() => {
      console.info(
        formatTime(Date.now()),
        `StartsToCopyData`,
        `from=${formatTime(taskContext.last_created_at)}`,
        title,
      );
    });

    collectSeriesAction$.pipe(takeUntil(dispose$)).subscribe(() => {
      taskContext.started_at = Date.now();
    });

    collectSeriesAction$
      .pipe(takeUntil(dispose$))
      .pipe(
        mergeMap(() =>
          defer(() =>
            terminal.client.requestService('CollectSeries', {
              table_name: task.table_name,
              series_id: task.series_id,
              started_at: taskContext.last_created_at,
              ended_at: Date.now(),
            }),
          ).pipe(
            tap((msg) => {
              if (msg.frame) {
                taskContext.api_status = msg.frame;
              }
              if (msg.res) {
                if (msg.res.code !== 0) {
                  throw msg.res.message;
                }
                taskComplete$.next();
              }
            }),
            // ISSUE: catch error will replace the whole stream with EMPTY, therefore it must be placed inside mergeMap
            // so that the outer stream subscription will not be affected
            catchError((e) => {
              taskContext.error_message = `${e}`;
              taskError$.next();
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();

    taskComplete$.pipe(takeUntil(dispose$)).subscribe(() => {
      taskContext.status = 'success';
      taskContext.completed_at = Date.now();
      taskContext.current_back_off_time = 0; // reset
      taskContext.error_message = ''; // reset error message
      console.info(formatTime(Date.now()), `TaskComplete`, title);
      taskFinalize$.next();
    });

    taskError$.pipe(takeUntil(dispose$)).subscribe(() => {
      taskContext.status = 'error';
      taskContext.completed_at = Date.now();
      // at most 5min
      taskContext.current_back_off_time = Math.min(taskContext.current_back_off_time + 10_000, 300_000);
      console.error(formatTime(Date.now()), `TaskError`, `${taskContext.error_message}`, title);
      taskFinalize$.next();
    });

    // Metrics Latency
    taskFinalize$.pipe(takeUntil(dispose$)).subscribe(() => {
      MetricDataCollectorLatencyMsBucket.observe(taskContext.completed_at - taskContext.started_at, {
        status: taskContext.status,
        series_id: task.series_id,
      });
    });

    // Retry Task if error
    taskFinalize$.pipe(takeUntil(dispose$)).subscribe(() => {
      if (taskContext.status === 'error') {
        console.info(formatTime(Date.now()), `TaskRetry`, title);
        timer(taskContext.current_back_off_time).subscribe(() => {
          taskScheduled$.next();
        });
      }
    });

    return () => {
      console.info(formatTime(Date.now()), `StopSyncing`, title);
      reportStatus();
      dispose$.next();
      taskContexts.delete(taskContext);
    };
  });
