import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  defer,
  firstValueFrom,
  from,
  map,
  mergeMap,
  repeat,
  retry,
  shareReplay,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { renderAlertMessageCard } from '../feishu/render-alert-message-card';
import type { IAlertGroup, IAlertMessageEntry, IAlertReceiveRoute, IAlertRecord } from '../types';
import { getSeverityIndex, normalizeSeverity } from '../utils';
import { normalizeLabelFilters, shouldDeliver } from './label-filters';

const mapSeverityToRepeatInterval: Record<string, number> = {
  UNKNOWN: 30 * 60_000,
  CRITICAL: 30 * 60_000,
  ERROR: 60 * 60_000,
  WARNING: 120 * 60_000,
  INFO: 360 * 60_000,
};

const terminal = Terminal.fromNodeEnv();

const normalizeRouteFromDb = (route: IAlertReceiveRoute): IAlertReceiveRoute => ({
  ...route,
  label_filters: normalizeLabelFilters((route as any).label_filters),
});

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

const normalizeRecordFromDb = (record: IAlertRecord): IAlertRecord => {
  const rawMessageIds = (record as any).message_ids;
  const rawLabels = (record as any).labels;
  let messageIds: IAlertMessageEntry[] | undefined;
  let labels: Record<string, string> = {};

  const parseMessageEntries = (entries: any[]): IAlertMessageEntry[] =>
    entries
      .map((entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof (entry as any).route_id === 'string' &&
        typeof (entry as any).message_id === 'string'
          ? { route_id: String((entry as any).route_id), message_id: String((entry as any).message_id) }
          : undefined,
      )
      .filter((entry): entry is IAlertMessageEntry => !!entry);

  if (Array.isArray(rawMessageIds)) {
    messageIds = parseMessageEntries(rawMessageIds);
  } else if (typeof rawMessageIds === 'string') {
    try {
      const parsed = JSON.parse(rawMessageIds);
      if (Array.isArray(parsed)) {
        messageIds = parseMessageEntries(parsed);
      }
    } catch (e) {
      console.warn(formatTime(Date.now()), 'ParseMessageIdsFailed', rawMessageIds, e);
    }
  }

  if (rawLabels && typeof rawLabels === 'object' && !Array.isArray(rawLabels)) {
    labels = Object.fromEntries(
      Object.entries(rawLabels).map(([key, value]) => [String(key), String(value)]),
    );
  } else if (typeof rawLabels === 'string') {
    try {
      const parsed = JSON.parse(rawLabels);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        labels = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
            String(key),
            String(value),
          ]),
        );
      }
    } catch (e) {
      console.warn(formatTime(Date.now()), 'ParseLabelsFailed', rawLabels, e);
    }
  }

  return {
    ...record,
    current_value: record.current_value ?? undefined,
    status: record.status === 'resolved' ? 'resolved' : 'firing',
    severity: normalizeSeverity(record.severity),
    summary: record.summary ?? undefined,
    description: record.description ?? undefined,
    runbook_url: record.runbook_url ?? undefined,
    end_time: record.end_time ?? undefined,
    labels,
    message_ids: messageIds ?? [],
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

const routeConfig$ = defer(() =>
  requestSQL<IAlertReceiveRoute[]>(terminal, `select * from alert_receive_route where enabled = TRUE`),
).pipe(
  retry({ delay: 1_000 }),
  repeat({ delay: 10_000 }),
  map((routes) => routes.map((route) => normalizeRouteFromDb(route))),
  shareReplay(1),
);

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
  const filteredRoutes = routes.filter((route) => shouldDeliver(route.label_filters, group.alerts));
  if (filteredRoutes.length === 0) {
    console.info(
      formatTime(Date.now()),
      'NoAlertReceiveRouteMatched',
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
    from(filteredRoutes).pipe(
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
