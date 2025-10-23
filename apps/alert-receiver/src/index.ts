import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL, writeToSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  Subject,
  catchError,
  defer,
  delay,
  filter,
  first,
  firstValueFrom,
  from,
  map,
  mergeMap,
  of,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
  timer,
  toArray,
} from 'rxjs';
import { renderAlertMessageCard } from './feishu/render-alert-message-card';
import type { IAlertGroup, IAlertMessageEntry, IAlertReceiveRoute, IAlertRecord } from './types';

/// Alert manager 消息
interface IAlertManagerMessage {
  receiver: string;
  status: string;
  alerts: IAlertManagerItem[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts: number;
}

interface IAlertManagerItem {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

const terminal = Terminal.fromNodeEnv();

const ENV = process.env.ENV ?? 'unknown';
const SEVERITY_ORDER = ['UNKNOWN', 'CRITICAL', 'ERROR', 'WARNING', 'INFO'] as const;
const getSeverityIndex = (value: string) => SEVERITY_ORDER.indexOf(value as (typeof SEVERITY_ORDER)[number]);

const mapSeverityToRepeatInterval: Record<string, number> = {
  UNKNOWN: 30 * 60_000,
  CRITICAL: 30 * 60_000,
  ERROR: 60 * 60_000,
  WARNING: 120 * 60_000,
  INFO: 360 * 60_000,
};

const makeUrgentPayload = (
  route: IAlertReceiveRoute,
  groupSeverity: string,
): { urgent: string; userIds: string[] } | undefined => {
  if (route.urgent_user_list.length === 0) return undefined;
  if (getSeverityIndex(groupSeverity) === -1) return undefined;
  if (getSeverityIndex(groupSeverity) > getSeverityIndex(route.urgent_on_severity)) {
    return undefined;
  }

  return { urgent: route.urgent_type, userIds: route.urgent_user_list };
};

const alertProcessing$ = new Subject<IAlertManagerMessage>();

alertProcessing$
  .pipe(
    tap((msg) => {
      if (msg.commonLabels['alertname'] === 'Watchdog') {
        keepAliveSignal$.next();
      }
    }),
  )
  .subscribe();

alertProcessing$
  .pipe(
    mergeMap((alertMsg) =>
      from(alertMsg.alerts).pipe(
        filter((alertItem) => !!alertItem.labels['alertname'] && alertItem.labels['severity'] !== 'none'),
        map((alertItem) => makeAlertRecord(alertMsg, alertItem)),
      ),
    ),
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
        'description',
        'env',
        'runbook_url',
        'group_name',
        'finalized',
        'start_time',
        'end_time',
      ],
      conflictKeys: ['id'],
    }),
  )
  .subscribe();

defer(() =>
  requestSQL<IAlertRecord[]>(
    terminal,
    `
    SELECT * FROM alert_record
    WHERE finalized = FALSE
    ORDER BY updated_at DESC
  `,
  ),
)
  .pipe(
    retry({ delay: 1_000 }),
    repeat({ delay: 5_000 }),
    map((records) => aggregateAlertsByGroup(records)),
  )
  .pipe(
    listWatch(
      (group) => group.group_key,
      (group) =>
        defer(() => handleAlertGroup(group)).pipe(
          tap({
            error: (e) => {
              console.error(formatTime(Date.now()), 'HandleAlertGroupFailed', group.group_key, e);
            },
          }),
          repeat({
            delay: () => {
              const interval = mapSeverityToRepeatInterval[group.severity] ?? 60 * 60_000;
              return timer(interval);
            },
          }),
        ),
      (a, b) => a.version === b.version,
    ),
  )
  .subscribe({
    error: (e) => console.error(formatTime(Date.now()), 'HandleAlertGroupFailed', e),
  });

const routeConfig$ = defer(() =>
  requestSQL<IAlertReceiveRoute[]>(terminal, `select * from alert_receive_route where enabled = TRUE`),
).pipe(retry({ delay: 1_000 }), repeat({ delay: 10_000 }), shareReplay(1));

const keepAliveSignal$ = new Subject<void>();

defer(() => keepAliveSignal$.pipe(first()))
  .pipe(
    tap(() => {
      console.info(formatTime(Date.now()), 'WatchdogReceived');
    }),
    timeout(5 * 60_000),
    catchError(() => {
      console.error(formatTime(Date.now()), 'WatchdogFailed', '超过 300 秒没有收到 Watchdog');

      const now = new Date();
      const syntheticMessage: IAlertManagerMessage = {
        receiver: 'watchdog',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'WatchdogFailed' },
            annotations: {
              description: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
              runbook_url: 'https://tradelife.feishu.cn/wiki/wikcn8hGhnA1fPBztoGyh6rRzqe',
            },
            startsAt: now.toISOString(),
            endsAt: '0001-01-01T00:00:00Z',
            generatorURL: '',
            fingerprint: `watchdog-${now.getTime()}`,
          },
        ],
        groupLabels: {},
        commonLabels: {
          alertname: 'WatchdogFailed',
          severity: 'CRITICAL',
          env: ENV,
        },
        commonAnnotations: {
          summary: 'AlertReceiver 超过 5 分钟未收到 Watchdog 消息',
          runbook_url: 'https://tradelife.feishu.cn/wiki/wikcn8hGhnA1fPBztoGyh6rRzqe',
        },
        externalURL: '',
        version: '4',
        groupKey: `watchdog-${ENV}`,
        truncatedAlerts: 0,
      };

      alertProcessing$.next(syntheticMessage);
      return defer(() => of(null)).pipe(delay(30 * 60_000));
    }),
    repeat(),
  )
  .subscribe();

terminal.server.provideService('/external/alertmanager/webhook', {}, async (msg) => {
  const { body } = msg.req as { body: string };
  console.info(formatTime(Date.now()), 'AlertReceived', body);
  const alertMsg = JSON.parse(body) as IAlertManagerMessage;

  alertProcessing$.next(alertMsg);

  return { res: { code: 0, message: 'OK', data: { status: 204 } } };
});

const makeAlertRecord = (alertMsg: IAlertManagerMessage, alertItem: IAlertManagerItem): IAlertRecord => {
  const status = alertItem.endsAt !== '0001-01-01T00:00:00Z' ? 'resolved' : 'firing';

  return {
    id: alertItem.fingerprint,
    alert_name: alertMsg.commonLabels['alertname'] ?? alertItem.labels['alertname'] ?? 'unknown',
    current_value: alertItem.annotations['current_value'],
    status,
    severity: normalizeSeverity(alertMsg.commonLabels['severity']),
    description: alertItem.annotations['description'],
    env: alertMsg.commonLabels['env'] ?? ENV,
    runbook_url: alertMsg.commonAnnotations['runbook_url'],
    group_name: alertMsg.groupKey,
    finalized: false,
    start_time: formatTime(new Date(alertItem.startsAt)),
    end_time: status === 'resolved' ? formatTime(new Date(alertItem.endsAt)) : undefined,
  };
};

const aggregateAlertsByGroup = (records: IAlertRecord[]): IAlertGroup[] => {
  const normalizedRecords = records.map(normalizeRecordFromDb);
  const groups = new Map<string, IAlertGroup>();

  for (const record of normalizedRecords) {
    const groupName = record.group_name || record.alert_name;

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        alert_name: record.alert_name,
        group_key: groupName,
        severity: 'UNKNOWN',
        alerts: [],
        status: 'Resolved',
        finalized: false,
        version: '',
      });
    }

    const group = groups.get(groupName)!;
    group.alerts.push(record);
  }

  for (const group of groups.values()) {
    group.alerts.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const firingCount = group.alerts.filter((alert) => alert.status === 'firing').length;
    const resolvedCount = group.alerts.length - firingCount;

    group.severity = group.alerts[0].severity;

    if (firingCount > 0 && resolvedCount > 0) {
      group.status = 'PartialResolved';
    } else if (firingCount > 0) {
      group.status = 'Firing';
    } else {
      group.status = 'Resolved';
    }

    group.finalized = firingCount === 0;
    group.version = JSON.stringify(
      group.alerts.map((alert) => ({
        id: alert.id,
        status: alert.status,
        end_time: alert.end_time,
        current_value: alert.current_value,
      })),
    );
  }

  return Array.from(groups.values());
};

const buildAlertCard = (group: IAlertGroup) => {
  const card = renderAlertMessageCard({
    ...group,
    alerts: group.alerts.map((alert) => ({
      ...alert,
      start_time: formatTime(alert.start_time),
      end_time: alert.end_time ? formatTime(alert.end_time) : undefined,
    })),
  });
  return card.dsl;
};

const handleAlertGroup = async (group: IAlertGroup) => {
  if (group.alerts.length === 0) {
    return;
  }

  const routes = await firstValueFrom(routeConfig$);
  if (routes.length === 0) {
    console.info(
      formatTime(Date.now()),
      'NoAlertReceiveRouteConfigured',
      JSON.stringify({
        group: group.group_key,
        alertName: group.alert_name,
      }),
    );
    return;
  }
  const cardDSL = JSON.stringify(buildAlertCard(group));
  const mapRouteIdToMessageId = new Map<string, string>();
  for (const alert of group.alerts) {
    const entries: IAlertMessageEntry[] = alert.message_ids ?? [];
    for (const entry of entries) {
      mapRouteIdToMessageId.set(entry.route_id, entry.message_id);
    }
  }

  await firstValueFrom(
    from(routes).pipe(
      mergeMap(async (route) => {
        const existingMessageId = mapRouteIdToMessageId.get(route.chat_id);
        const urgentPayload = makeUrgentPayload(route, group.severity);
        const payload = existingMessageId
          ? {
              message_id: existingMessageId,
              msg_type: 'interactive',
              content: cardDSL,
              ...(urgentPayload
                ? { urgent: urgentPayload.urgent, urgent_user_list: urgentPayload.userIds }
                : {}),
            }
          : {
              receive_id: route.chat_id,
              receive_id_type: 'chat_id',
              msg_type: 'interactive',
              content: cardDSL,
              ...(urgentPayload
                ? { urgent: urgentPayload.urgent, urgent_user_list: urgentPayload.userIds }
                : {}),
            };

        const serviceName = existingMessageId ? 'Feishu/UpdateMessage' : 'Feishu/SendMessage';

        const result = await terminal.client.requestForResponse<typeof payload, { message_id: string }>(
          serviceName,
          payload,
        );

        if (result.code !== 0) {
          throw new Error(`SendFeishuCardFailed: ${result.message}`);
        }

        const messageId = result.data?.message_id ?? existingMessageId;
        if (messageId) {
          mapRouteIdToMessageId.set(route.chat_id, messageId);
        }
      }),
      toArray(),
    ),
  );

  const messageEntries = Array.from(mapRouteIdToMessageId.entries()).map(([route_id, message_id]) => ({
    route_id,
    message_id,
  }));

  console.info(
    formatTime(Date.now()),
    'FeishuAlertMessageIdsUpdated',
    JSON.stringify(messageEntries),
    'for group',
    group.group_key,
    'version',
    group.version,
  );

  await requestSQL(
    terminal,
    `
        UPDATE alert_record
        SET message_ids = ${escapeSQL(JSON.stringify(messageEntries))}::jsonb
        WHERE group_name = ${escapeSQL(group.group_key)}
      `,
  );

  if (group.finalized) {
    await requestSQL(
      terminal,
      `
          UPDATE alert_record
          SET finalized = TRUE
          WHERE group_name = ${escapeSQL(group.group_key)}
        `,
    );
  }
};

const normalizeRecordFromDb = (record: IAlertRecord): IAlertRecord => {
  const rawMessageIds = (record as any).message_ids;
  let messageIds: IAlertMessageEntry[] | undefined;
  if (Array.isArray(rawMessageIds)) {
    messageIds = rawMessageIds
      .map((entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof (entry as any).route_id === 'string' &&
        typeof (entry as any).message_id === 'string'
          ? { route_id: String((entry as any).route_id), message_id: String((entry as any).message_id) }
          : undefined,
      )
      .filter((entry): entry is IAlertMessageEntry => !!entry);
  } else if (typeof rawMessageIds === 'string') {
    try {
      const parsed = JSON.parse(rawMessageIds);
      if (Array.isArray(parsed)) {
        messageIds = parsed
          .map((entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof (entry as any).route_id === 'string' &&
            typeof (entry as any).message_id === 'string'
              ? { route_id: String((entry as any).route_id), message_id: String((entry as any).message_id) }
              : undefined,
          )
          .filter((entry): entry is IAlertMessageEntry => !!entry);
      }
    } catch (e) {
      console.warn(formatTime(Date.now()), 'ParseMessageIdsFailed', rawMessageIds, e);
    }
  }

  return {
    ...record,
    current_value: record.current_value ?? undefined,
    status: record.status === 'resolved' ? 'resolved' : 'firing',
    severity: normalizeSeverity(record.severity),
    description: record.description ?? undefined,
    runbook_url: record.runbook_url ?? undefined,
    end_time: record.end_time ?? undefined,
    message_ids: messageIds ?? [],
  };
};

const normalizeSeverity = (severity: string | undefined): string => {
  if (!severity) return 'UNKNOWN';
  const upper = severity.toUpperCase();
  if (getSeverityIndex(upper) !== -1) {
    return upper;
  }
  return 'UNKNOWN';
};
