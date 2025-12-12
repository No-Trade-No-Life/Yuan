import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime, listWatch } from '@yuants/utils';
import {
  catchError,
  defer,
  EMPTY,
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
import { computeGroupSeverity, getSeverityIndex, normalizeSeverity } from '../utils';
import { filterAlertsByRoute } from './label-filters';

const mapSeverityToRepeatInterval: Record<string, number> = {
  UNKNOWN: 30 * 60_000,
  CRITICAL: 30 * 60_000,
  ERROR: 60 * 60_000,
  WARNING: 120 * 60_000,
  INFO: 360 * 60_000,
};

const terminal = Terminal.fromNodeEnv();
// 同一个 group + route 的加急限频（仅内存，重启后重置）
// 默认 10 分钟一次，可通过环境变量调整
const URGENT_MIN_INTERVAL_MS = Number(process.env.ALERT_URGENT_MIN_INTERVAL_MS ?? 10 * 60_000);
// key: `${group_key}::${chat_id}` -> last urgent timestamp (ms)
const lastUrgentAtByGroupRoute = new Map<string, number>();

const getGroupRouteKey = (groupKey: string, routeId: string) => `${groupKey}::${routeId}`;

const allowUrgentForGroupRoute = (groupKey: string, routeId: string, now: number) => {
  const key = getGroupRouteKey(groupKey, routeId);
  const lastUrgentAt = lastUrgentAtByGroupRoute.get(key);
  // 最近一次加急未超过最小间隔，则本轮不加急
  if (lastUrgentAt !== undefined && now - lastUrgentAt < URGENT_MIN_INTERVAL_MS) {
    return false;
  }
  return true;
};

const normalizeRouteFromDb = (route: IAlertReceiveRoute): IAlertReceiveRoute => {
  const normalizedRoute: IAlertReceiveRoute = {
    ...route,
    label_schema: (route as any).label_schema ?? undefined,
  };
  return normalizedRoute;
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

const compareAlertRecords = (a: IAlertRecord, b: IAlertRecord) => {
  const startTimeCompare = a.start_time.localeCompare(b.start_time);
  if (startTimeCompare !== 0) return startTimeCompare;
  return a.id.localeCompare(b.id);
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
    group.alerts.sort(compareAlertRecords);

    const firingCount = group.alerts.filter((alert) => alert.status === 'firing').length;
    const resolvedCount = group.alerts.length - firingCount;

    group.severity = computeGroupSeverity(group.alerts);

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

const summarizeAlerts = (alerts: IAlertRecord[]) => {
  const sortedAlerts = [...alerts].sort(compareAlertRecords);
  const firingCount = sortedAlerts.filter((alert) => alert.status === 'firing').length;
  const resolvedCount = sortedAlerts.length - firingCount;

  let status: IAlertGroup['status'] = 'Resolved';
  if (firingCount > 0 && resolvedCount > 0) {
    status = 'PartialResolved';
  } else if (firingCount > 0) {
    status = 'Firing';
  }

  const severity = computeGroupSeverity(sortedAlerts);
  const finalized = firingCount === 0;
  const version = JSON.stringify(
    sortedAlerts.map((alert) => ({
      id: alert.id,
      status: alert.status,
    })),
  );

  return { alerts: sortedAlerts, firingCount, status, severity, finalized, version };
};

type MatchedRoute = { route: IAlertReceiveRoute; routeGroup: IAlertGroup };
type MessageIndex = Map<string, string>;

const matchRoutesWithSummary = (group: IAlertGroup, routes: IAlertReceiveRoute[]): MatchedRoute[] =>
  routes
    .map((route) => {
      const matchedAlerts = filterAlertsByRoute(route, group.alerts);
      if (matchedAlerts.length === 0) return undefined;
      const summary = summarizeAlerts(matchedAlerts);
      const routeGroup: IAlertGroup = {
        ...group,
        alerts: summary.alerts,
        severity: summary.severity,
        status: summary.status,
        finalized: summary.finalized,
        version: summary.version,
      };
      return { route, routeGroup };
    })
    .filter((entry): entry is MatchedRoute => !!entry);

const collectMessageIndex = (alerts: IAlertRecord[]): MessageIndex => {
  const mapRouteIdToMessageId = new Map<string, string>();
  for (const alert of alerts) {
    const entries: IAlertMessageEntry[] = alert.message_ids ?? [];
    for (const entry of entries) {
      mapRouteIdToMessageId.set(entry.route_id, entry.message_id);
    }
  }
  return mapRouteIdToMessageId;
};

const sendOrUpdateMessage = async (
  route: IAlertReceiveRoute,
  routeGroup: IAlertGroup,
  messageIndex: MessageIndex,
) => {
  const existingMessageId = messageIndex.get(route.chat_id);
  const now = Date.now();
  // 先按路由/严重性判定是否“想要加急”
  const wantedUrgentPayload = makeUrgentPayload(route, routeGroup.severity);
  // 再按 group_key + chat_id 做限频，决定本轮是否真正带 urgent
  const urgentAllowed =
    wantedUrgentPayload && allowUrgentForGroupRoute(routeGroup.group_key, route.chat_id, now);
  const urgentPayload = urgentAllowed ? wantedUrgentPayload : undefined;
  const cardDSL = JSON.stringify(buildAlertCard(routeGroup));
  const basePayload = {
    msg_type: 'interactive',
    content: cardDSL,
    ...(urgentPayload ? { urgent: urgentPayload.urgent, urgent_user_list: urgentPayload.userIds } : {}),
  };

  const payload = existingMessageId
    ? {
        ...basePayload,
        message_id: existingMessageId,
      }
    : {
        ...basePayload,
        receive_id: route.chat_id,
        receive_id_type: 'chat_id',
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
    messageIndex.set(route.chat_id, messageId);
  }

  // 只有当本次确实带了加急并成功发送/更新后，才写入冷却时间
  if (urgentPayload) {
    lastUrgentAtByGroupRoute.set(getGroupRouteKey(routeGroup.group_key, route.chat_id), now);
  }
};

const collectAlertMessageUpdates = (
  group: IAlertGroup,
  matches: MatchedRoute[],
  messageIndex: MessageIndex,
): { id: string; entriesJson: string }[] => {
  const alertIdToEntries = new Map<string, IAlertMessageEntry[]>();

  for (const { route, routeGroup } of matches) {
    const messageId = messageIndex.get(route.chat_id);
    if (!messageId) continue;
    for (const alert of routeGroup.alerts) {
      const existingEntries = alertIdToEntries.get(alert.id) ?? [];
      const entry = { route_id: route.chat_id, message_id: messageId };
      const nextEntries = [...existingEntries, entry];
      alertIdToEntries.set(alert.id, nextEntries);
      alert.message_ids = nextEntries;
    }
  }

  return group.alerts.map((alert) => {
    const entries = alertIdToEntries.get(alert.id) ?? [];
    alert.message_ids = entries;
    return {
      id: alert.id,
      entriesJson: JSON.stringify(entries),
    };
  });
};

const updateAlertMessageIds = async (updates: { id: string; entriesJson: string }[]) => {
  const updateSQL = `
        UPDATE alert_record
        SET message_ids = CASE id
        ${updates
          .map(({ id, entriesJson }) => `WHEN ${escapeSQL(id)} THEN ${escapeSQL(entriesJson)}::jsonb`)
          .join('\n')}
          ELSE message_ids
        END
        WHERE id IN (${updates.map(({ id }) => escapeSQL(id)).join(', ')})
      `;
  await requestSQL(terminal, updateSQL);
};

const finalizeGroupRecords = async (group: IAlertGroup) => {
  await requestSQL(
    terminal,
    `
          UPDATE alert_record
          SET finalized = TRUE,
              message_ids = '[]'::jsonb
          WHERE group_name = ${escapeSQL(group.group_key)}
        `,
  );
};

const handleAlertGroup = async (group: IAlertGroup) => {
  // Step 1: 快速跳过空告警组
  if (group.alerts.length === 0) {
    return;
  }

  // Step 2: 获取启用的路由配置，若缺失则记录并返回
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

  // Step 3: 基于路由筛选符合条件的告警并生成汇总
  const matches = matchRoutesWithSummary(group, routes);

  if (matches.length === 0) {
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

  // Step 4: 收集现有 messageId，后续用于更新或发送
  const messageIndex = collectMessageIndex(group.alerts);

  // Step 5: 并行发送或更新消息卡片
  await firstValueFrom(
    from(matches).pipe(
      mergeMap(({ route, routeGroup }) =>
        defer(() => sendOrUpdateMessage(route, routeGroup, messageIndex)).pipe(
          catchError((e) => {
            console.error(formatTime(Date.now()), 'SendOrUpdateMessageFailed', route.chat_id, e);
            return EMPTY;
          }),
        ),
      ),
      toArray(),
    ),
  );

  // Step 6: 记录更新后的 route-message 映射
  const messageEntries = Array.from(messageIndex.entries()).map(([route_id, message_id]) => ({
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

  // Step 7: 汇总需要写回数据库的 message_id 信息
  const updates = collectAlertMessageUpdates(group, matches, messageIndex);

  if (updates.length > 0) {
    await updateAlertMessageIds(updates);
  }

  // Step 8: 若所有告警已终态则统一标记 finalized
  if (group.finalized) {
    await finalizeGroupRecords(group);
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
          // 防止带崩整个 listWatch 流
          catchError(() => EMPTY),
        ),
      (a, b) => a.version === b.version,
    ),
  )
  .subscribe({
    error: (e) => console.error(formatTime(Date.now()), 'HandleAlertGroupFailed', e),
  });
