import * as schemaModule from '@yuants/protocol/lib/schema';
import type { JSONSchema7 } from 'json-schema';
import type { IAlertReceiveRoute, IAlertRecord } from '../types';
import { filterAlertsByRoute } from './label-filters';

const makeAlert = (overrides: Partial<IAlertRecord>): IAlertRecord => ({
  id: overrides.id ?? `alert-${Math.random()}`,
  alert_name: overrides.alert_name ?? 'TestAlert',
  current_value: overrides.current_value,
  status: overrides.status ?? 'firing',
  severity: overrides.severity ?? 'CRITICAL',
  summary: overrides.summary,
  description: overrides.description,
  env: overrides.env ?? 'prod',
  runbook_url: overrides.runbook_url,
  group_name: overrides.group_name ?? 'group-1',
  labels: overrides.labels ?? {},
  finalized: overrides.finalized ?? false,
  start_time: overrides.start_time ?? '2024-01-01T00:00:00.000Z',
  end_time: overrides.end_time,
  message_ids: overrides.message_ids,
  created_at: overrides.created_at,
  updated_at: overrides.updated_at,
});

const makeRoute = (schema?: JSONSchema7): IAlertReceiveRoute => ({
  chat_id: 'chat-id',
  urgent_on_severity: 'UNKNOWN',
  urgent_user_list: [],
  urgent_type: 'app',
  label_schema: schema,
  enabled: true,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
});

describe('filterAlertsByRoute', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('passes through when schema missing', () => {
    const route = makeRoute();
    const alerts = [makeAlert({ labels: { env: 'dev' } })];
    expect(filterAlertsByRoute(route, alerts)).toEqual(alerts);
  });

  it('passes through using allow-all schema', () => {
    const allowAllSchema: JSONSchema7 = { type: 'object' };
    const route = makeRoute(allowAllSchema);
    const alerts = [
      makeAlert({ id: 'a1', labels: { env: 'dev' } }),
      makeAlert({ id: 'a2', labels: { env: 'prod', team: 'ops' } }),
    ];
    expect(filterAlertsByRoute(route, alerts)).toEqual(alerts);
  });

  it('returns only alerts matching schema constraints', () => {
    const route = makeRoute({
      type: 'object',
      required: ['env'],
      properties: {
        env: { const: 'prod' },
      },
      additionalProperties: true,
    });

    const matching = makeAlert({ id: 'match', labels: { env: 'prod' } });
    const nonMatching = makeAlert({ id: 'miss', labels: { env: 'test' } });

    expect(filterAlertsByRoute(route, [nonMatching, matching])).toEqual([matching]);
  });

  it('falls back to passthrough when validator creation throws', () => {
    jest.spyOn(schemaModule, 'createValidator').mockImplementation(() => {
      throw new Error('boom');
    });

    const route = makeRoute({ type: 'object' });
    const alerts = [makeAlert({ labels: { env: 'prod' } })];

    expect(filterAlertsByRoute(route, alerts)).toEqual(alerts);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.any(Number),
      'LabelSchemaValidatorCreationFailed',
      expect.any(Error),
    );
  });
});
