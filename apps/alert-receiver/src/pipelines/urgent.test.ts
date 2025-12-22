import type { IAlertGroup, IAlertReceiveRoute } from '../types';
import { computeWantedUrgentPayload } from './urgent';

const makeRoute = (overrides?: Partial<IAlertReceiveRoute>): IAlertReceiveRoute => ({
  chat_id: 'chat_1',
  enabled: true,
  urgent_on_severity: 'ERROR',
  urgent_type: 'app',
  urgent_user_list: ['u1'],
  created_at: '',
  updated_at: '',
  ...overrides,
});

const makeGroup = (overrides?: Partial<IAlertGroup>): IAlertGroup => ({
  alert_name: 'a',
  group_key: 'g',
  severity: 'CRITICAL',
  alerts: [],
  status: 'Firing',
  finalized: false,
  version: '',
  ...overrides,
});

describe('computeWantedUrgentPayload', () => {
  it('does not urgent for Resolved group', () => {
    const route = makeRoute();
    const group = makeGroup({ status: 'Resolved', severity: 'CRITICAL' });
    expect(computeWantedUrgentPayload(route, group)).toBeUndefined();
  });

  it('allows urgent for Firing group when severity matches', () => {
    const route = makeRoute({ urgent_on_severity: 'ERROR' });
    const group = makeGroup({ status: 'Firing', severity: 'ERROR' });
    expect(computeWantedUrgentPayload(route, group)).toEqual({ urgent: 'app', userIds: ['u1'] });
  });
});
