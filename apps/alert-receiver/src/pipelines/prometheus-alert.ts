import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { formatTime, listWatchEvent } from '@yuants/utils';
import {
  defer,
  EMPTY,
  filter,
  from,
  map,
  merge,
  mergeMap,
  of,
  repeat,
  retry,
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

const alertRecordEvents$ = activeAlertRecords$.pipe(
  listWatchEvent(
    (record) => record.id,
    (a, b) => a.id === b.id && a.current_value === b.current_value,
  ),
  mergeMap((events) =>
    from(events).pipe(
      mergeMap(([oldRecord, newRecord]) => {
        if (newRecord && oldRecord) {
          return of({
            ...oldRecord,
            current_value: newRecord.current_value,
            description: newRecord.description,
            summary: newRecord.summary,
          });
        }
        if (newRecord) {
          return of(newRecord);
        }
        if (oldRecord) {
          return timer(RESOLVE_GRACE_MS).pipe(
            withLatestFrom(activeAlertRecords$),
            filter(([, current]) => !current.some((record) => record.id === oldRecord.id)),
            map(() => ({
              ...oldRecord,
              status: 'resolved',
              end_time: formatTime(Date.now()),
              finalized: false,
            })),
          );
        }
        return EMPTY;
      }),
    ),
  ),
);

merge(alertRecordEvents$, watchdogRecordSubject)
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
