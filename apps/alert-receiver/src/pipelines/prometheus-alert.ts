import { Terminal } from '@yuants/protocol';
import { requestSQL, writeToSQL } from '@yuants/sql';
import { batchGroupBy, formatTime } from '@yuants/utils';
import {
  catchError,
  defer,
  exhaustMap,
  filter,
  from,
  map,
  merge,
  mergeMap,
  of,
  repeat,
  retry,
  share,
  shareReplay,
  tap,
  timer,
  withLatestFrom,
} from 'rxjs';
import { computeAlertFingerprint, computeAlertGroupKey } from '../alertmanager-compatible-utils';
import type { IAlertRecord } from '../types';
import { normalizeSeverity } from '../utils';
import { signalPrometheusFetchSuccess, watchdogRecordSubject } from './watchdog';

/**
 * Prometheus `/api/v1/alerts` response payload.
 * @see https://github.com/prometheus/prometheus/blob/main/web/api/v1/api.go#L1337-L1366
 */
interface IPrometheusAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: string;
  activeAt?: string;
  keepFiringSince?: string;
  value: string;
}

interface IPrometheusAlertsResponse {
  status: string;
  data: {
    alerts: IPrometheusAlert[];
  };
}

const terminal = Terminal.fromNodeEnv();
const ENV = process.env.ENV ?? 'unknown';
const PROMETHEUS_NAME = process.env.PROMETHEUS_NAME ?? 'prometheus';
const RESOLVE_GRACE_MS = Number(process.env.ALERT_RESOLVE_GRACE_MS ?? 15_000);

const normalizePrometheusAlert = (alert: IPrometheusAlert): IAlertRecord | undefined => {
  const labels = { ...alert.labels };
  const alertName = labels['alertname'];
  if (!alertName) return undefined;

  const severityLabel = labels['severity'];
  if (severityLabel?.toLowerCase() === 'none') return undefined;

  labels['prometheus'] = PROMETHEUS_NAME;
  if (!labels['env']) {
    labels['env'] = ENV;
  }

  const envLabel = labels['env'] ?? ENV;
  const severity = normalizeSeverity(severityLabel);
  const description = alert.annotations['description'] ?? alert.annotations['summary'];
  const summary = alert.annotations['summary'];
  const runbookUrl = alert.annotations['runbook_url'] ?? alert.annotations['runbook'];
  const startTime = formatTime(alert.activeAt ?? Date.now());

  const groupLabels: Record<string, string> = {
    alertname: alertName,
    severity,
    env: envLabel,
    prometheus: labels['prometheus'],
  };

  const groupName = computeAlertGroupKey('{}', groupLabels);
  const fingerprint = computeAlertFingerprint(labels);
  return {
    id: fingerprint,
    alert_name: alertName,
    severity,
    description,
    summary,
    env: envLabel,
    current_value: alert.value,
    runbook_url: runbookUrl,
    group_name: groupName,
    labels,
    start_time: startTime,
    status: 'firing',
    finalized: false,
    end_time: undefined,
  };
};

const activeAlertRecords$ = defer(() =>
  terminal.client.requestForResponseData<{}, IPrometheusAlertsResponse>('prometheus/alerts', {}),
).pipe(
  tap(() => {
    signalPrometheusFetchSuccess();
  }),
  tap({
    error: (err) => {
      console.error(formatTime(Date.now()), 'FetchPrometheusAlertsFailed', err);
    },
  }),
  retry({ delay: () => timer(5000) }),
  repeat({ delay: () => timer(5000) }),
  map((res) => res.data?.alerts ?? []),
  map((alerts) =>
    alerts
      .filter((v) => v.state === 'firing')
      .map(normalizePrometheusAlert)
      .filter((record): record is IAlertRecord => !!record),
  ),
  shareReplay(1),
);

const reconciliation$ = activeAlertRecords$.pipe(
  exhaustMap((currentRecords) => {
    const sql = `
      SELECT
        id,
        alert_name,
        current_value,
        status,
        severity,
        summary,
        description,
        env,
        runbook_url,
        group_name,
        labels,
        finalized,
        start_time,
        end_time
      FROM alert_record
      WHERE status = 'firing'
    `;
    return defer(() => requestSQL<IAlertRecord[]>(terminal, sql)).pipe(
      catchError((err) => {
        console.error(formatTime(Date.now()), 'FetchFiringAlertRecordsFailed', err);
        return of([] as IAlertRecord[]);
      }),
      map((dbFiringRecords) => ({ currentRecords, dbFiringRecords })),
    );
  }),
  share(),
);

const firingUpserts$ = reconciliation$.pipe(mergeMap(({ currentRecords }) => from(currentRecords)));

const missingCandidates$ = reconciliation$.pipe(
  mergeMap(({ currentRecords, dbFiringRecords }) => {
    const currentIds = new Set(currentRecords.map((record) => record.id));
    return of(dbFiringRecords.filter((record) => !currentIds.has(record.id)));
  }),
);

const resolvedUpserts$ = missingCandidates$.pipe(
  batchGroupBy((record) => record.id),
  mergeMap((group$) =>
    group$.pipe(
      exhaustMap((record) =>
        timer(RESOLVE_GRACE_MS).pipe(
          withLatestFrom(activeAlertRecords$),
          filter(([, latest]) => !latest.some((r) => r.id === record.id)),
          map(() => ({
            ...record,
            status: 'resolved',
            end_time: formatTime(Date.now()),
            finalized: false,
          })),
        ),
      ),
    ),
  ),
);

merge(firingUpserts$, resolvedUpserts$, watchdogRecordSubject)
  .pipe(
    writeToSQL<IAlertRecord>({
      terminal,
      tableName: 'alert_record',
      writeInterval: 1_000,
      columns: [
        'id',
        'alert_name',
        'current_value',
        'status',
        'severity',
        'summary',
        'description',
        'env',
        'runbook_url',
        'group_name',
        'labels',
        'finalized',
        'start_time',
        'end_time',
      ],
      conflictKeys: ['id'],
    }),
  )
  .subscribe();
