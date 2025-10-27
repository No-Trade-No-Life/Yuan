import type { IAlertLabelRule, IAlertRecord } from '../types';
import { matchLabelRule, normalizeLabelFilters, shouldDeliver } from './label-filters';

const makeAlert = (overrides: Partial<IAlertRecord>): IAlertRecord => ({
  id: overrides.id ?? 'alert-1',
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

describe('normalizeLabelFilters', () => {
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('ignores unsupported operators', () => {
    const filters = normalizeLabelFilters([{ key: 'env', operator: '>=', value: 'prod' }]);
    expect(filters).toHaveLength(0);
  });

  it('keeps only the first rule per key', () => {
    const filters = normalizeLabelFilters([
      { key: 'env', operator: '==', value: 'prod' },
      { key: 'env', operator: '!=', value: 'dev' },
    ]);
    expect(filters).toEqual([{ key: 'env', operator: '==', value: 'prod' }]);
  });
});

describe('matchLabelRule', () => {
  it('matches equality operator', () => {
    expect(matchLabelRule({ env: 'prod' }, { key: 'env', operator: '==', value: 'prod' })).toBe(true);
  });

  it('matches inequality operator when value differs', () => {
    expect(matchLabelRule({ env: 'prod' }, { key: 'env', operator: '!=', value: 'dev' })).toBe(true);
  });

  it('matches regex operator', () => {
    expect(
      matchLabelRule({ service: 'order' }, { key: 'service', operator: '=~', value: '^(order|trade)$' }),
    ).toBe(true);
  });

  it('matches negative regex operator', () => {
    expect(matchLabelRule({ service: 'order' }, { key: 'service', operator: '!~', value: '^test-' })).toBe(
      true,
    );
  });
});

describe('shouldDeliver', () => {
  it('delivers when filters empty', () => {
    expect(shouldDeliver([], [makeAlert({ labels: { env: 'prod' } })])).toBe(true);
  });

  it('delivers when any alert satisfies all rules', () => {
    const filters: IAlertLabelRule[] = [{ key: 'env', operator: '==', value: 'prod' }];
    const alerts = [
      makeAlert({ id: 'a1', labels: { env: 'dev' } }),
      makeAlert({ id: 'a2', labels: { env: 'prod' } }),
    ];
    expect(shouldDeliver(filters, alerts)).toBe(true);
  });

  it('blocks delivery when no alerts satisfy rules', () => {
    const filters: IAlertLabelRule[] = [{ key: 'env', operator: '==', value: 'prod' }];
    const alerts = [makeAlert({ labels: { env: 'test' } })];
    expect(shouldDeliver(filters, alerts)).toBe(false);
  });
});
