import { formatTime } from '@yuants/utils';
import { Subject, catchError, defer, delay, first, of, repeat, tap, timeout } from 'rxjs';
import { computeAlertFingerprint, computeAlertGroupKey } from '../alertmanager-compatible-utils';
import type { IAlertRecord } from '../types';

const ENV = process.env.ENV ?? 'unknown';
const PROMETHEUS_NAME = process.env.PROMETHEUS_NAME ?? 'prometheus';
const WATCHDOG_RUNBOOK_URL = 'https://tradelife.feishu.cn/wiki/wikcn8hGhnA1fPBztoGyh6rRzqe';

const WATCHDOG_LABELS = {
  alertname: 'PrometheusFetchWatchdog',
  severity: 'CRITICAL',
  env: ENV,
  prometheus: PROMETHEUS_NAME,
};

const WATCHDOG_GROUP_LABELS = {
  alertname: WATCHDOG_LABELS.alertname,
  severity: WATCHDOG_LABELS.severity,
  env: WATCHDOG_LABELS.env,
  prometheus: WATCHDOG_LABELS.prometheus,
};

const WATCHDOG_ALERT_ID = computeAlertFingerprint(WATCHDOG_LABELS);
const WATCHDOG_GROUP_NAME = computeAlertGroupKey('{}', WATCHDOG_GROUP_LABELS);

const keepAliveSignal$ = new Subject<void>();
export const watchdogRecordSubject = new Subject<IAlertRecord>();

let watchdogAlertActive = false;
let watchdogAlertStartTime: string | undefined;

const emitWatchdogRecord = (status: 'firing' | 'resolved') => {
  const startTime =
    status === 'firing' ? formatTime(Date.now()) : watchdogAlertStartTime ?? formatTime(Date.now());
  if (status === 'firing') {
    watchdogAlertStartTime = startTime;
  } else {
    watchdogAlertStartTime = undefined;
  }

  watchdogRecordSubject.next({
    id: WATCHDOG_ALERT_ID,
    alert_name: WATCHDOG_LABELS.alertname,
    current_value: undefined,
    status,
    summary:
      status === 'firing'
        ? 'AlertReceiver 未成功请求 Prometheus Alerts'
        : 'AlertReceiver 已恢复请求 Prometheus Alerts',
    severity: WATCHDOG_LABELS.severity,
    description:
      status === 'firing'
        ? 'AlertReceiver 超过 60 秒未成功请求 Prometheus Alerts'
        : 'AlertReceiver 已恢复成功请求 Prometheus Alerts',
    env: WATCHDOG_LABELS.env,
    runbook_url: WATCHDOG_RUNBOOK_URL,
    group_name: WATCHDOG_GROUP_NAME,
    labels: WATCHDOG_LABELS,
    finalized: false,
    start_time: startTime,
    end_time: status === 'resolved' ? formatTime(Date.now()) : undefined,
  });
};

export const signalPrometheusFetchSuccess = () => {
  if (watchdogAlertActive) {
    emitWatchdogRecord('resolved');
    watchdogAlertActive = false;
  }
  keepAliveSignal$.next();
};

defer(() => keepAliveSignal$.pipe(first()))
  .pipe(
    tap(() => {
      console.info(formatTime(Date.now()), 'PrometheusAlertsWatchdogSuccess');
    }),
    timeout(60_000),
    catchError(() => {
      console.error(
        formatTime(Date.now()),
        'PrometheusAlertsWatchdogTimeout',
        '超过 60 秒未成功请求 Prometheus Alerts',
      );
      if (!watchdogAlertActive) {
        emitWatchdogRecord('firing');
        watchdogAlertActive = true;
      }
      return defer(() => of(null)).pipe(delay(30 * 60_000));
    }),
    repeat(),
  )
  .subscribe();
