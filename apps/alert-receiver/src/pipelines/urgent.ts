import type { IAlertGroup, IAlertReceiveRoute } from '../types';
import { getSeverityIndex } from '../utils';

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

export const computeWantedUrgentPayload = (
  route: IAlertReceiveRoute,
  group: IAlertGroup,
): { urgent: string; userIds: string[] } | undefined => {
  if (group.status === 'Resolved') return undefined;
  return makeUrgentPayload(route, group.severity);
};
