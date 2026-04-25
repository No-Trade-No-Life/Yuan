import { createHash } from 'node:crypto';
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { DomainEvent } from '@yuants/signal-trader';
import {
  CheckpointRepository,
  EventStore,
  OrderBindingRepository,
  RuntimeAuditLogRepository,
  RuntimeConfigRepository,
  SignalTraderRuntimeAuditLog,
  SignalTraderOrderBinding,
  SignalTraderPersistedEvent,
  SignalTraderRuntimeCheckpoint,
  SignalTraderRuntimeConfig,
} from '../types';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

export const hashSnapshot = (snapshot: unknown) =>
  createHash('sha256').update(stableStringify(snapshot)).digest('hex');

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export class InMemoryRuntimeConfigRepository implements RuntimeConfigRepository {
  private readonly data = new Map<string, SignalTraderRuntimeConfig>();

  async upsert(config: SignalTraderRuntimeConfig): Promise<SignalTraderRuntimeConfig> {
    const now = new Date().toISOString();
    const next = clone({
      ...config,
      created_at: this.data.get(config.runtime_id)?.created_at ?? now,
      updated_at: now,
    });
    this.data.set(config.runtime_id, next);
    return clone(next);
  }

  async get(runtime_id: string) {
    const value = this.data.get(runtime_id);
    return value ? clone(value) : undefined;
  }

  async list() {
    return [...this.data.values()].map(clone);
  }

  async disable(runtime_id: string) {
    const current = this.data.get(runtime_id);
    if (!current) return;
    this.data.set(runtime_id, { ...current, enabled: false, updated_at: new Date().toISOString() });
  }
}

export class InMemoryEventStore implements EventStore {
  private readonly data = new Map<string, SignalTraderPersistedEvent[]>();

  async append(runtime_id: string, events: DomainEvent[]) {
    const bucket = this.data.get(runtime_id) ?? [];
    const eventIds = new Set(bucket.map((item) => item.event_id));
    const inserted: SignalTraderPersistedEvent[] = [];
    for (const event of events) {
      if (eventIds.has(event.event_id)) continue;
      const persisted: SignalTraderPersistedEvent = {
        ...clone(event),
        runtime_id,
        event_offset: bucket.length + inserted.length + 1,
        event_created_at_ms: event.created_at,
        persisted_at: new Date().toISOString(),
      };
      inserted.push(persisted);
      eventIds.add(event.event_id);
    }
    const next = [...bucket, ...inserted];
    this.data.set(runtime_id, next);
    return inserted.map(clone);
  }

  async list(runtime_id: string, options?: { after_offset?: number }) {
    return (this.data.get(runtime_id) ?? [])
      .filter((item) => item.event_offset > (options?.after_offset ?? 0))
      .map(clone);
  }
}

export class InMemoryOrderBindingRepository implements OrderBindingRepository {
  private readonly data = new Map<string, SignalTraderOrderBinding>();

  private key(runtime_id: string, internal_order_id: string) {
    return `${runtime_id}::${internal_order_id}`;
  }

  async upsert(binding: SignalTraderOrderBinding) {
    const now = new Date().toISOString();
    const key = this.key(binding.runtime_id, binding.internal_order_id);
    const next = clone({ ...binding, created_at: this.data.get(key)?.created_at ?? now, updated_at: now });
    this.data.set(key, next);
    return clone(next);
  }

  async get(runtime_id: string, internal_order_id: string) {
    const value = this.data.get(this.key(runtime_id, internal_order_id));
    return value ? clone(value) : undefined;
  }

  async getByExternalOperateOrderId(runtime_id: string, external_operate_order_id: string) {
    for (const value of this.data.values()) {
      if (value.runtime_id === runtime_id && value.external_operate_order_id === external_operate_order_id) {
        return clone(value);
      }
    }
    return undefined;
  }

  async listByRuntime(runtime_id: string) {
    return [...this.data.values()].filter((item) => item.runtime_id === runtime_id).map(clone);
  }

  async listInFlight(runtime_id: string, product_id: string) {
    return [...this.data.values()]
      .filter(
        (item) =>
          item.runtime_id === runtime_id &&
          item.product_id === product_id &&
          ['submitted', 'accepted', 'partially_filled', 'unknown', 'timeout'].includes(item.binding_status),
      )
      .map(clone);
  }
}

export class InMemoryCheckpointRepository implements CheckpointRepository {
  private readonly data = new Map<string, SignalTraderRuntimeCheckpoint>();

  async get(runtime_id: string) {
    const value = this.data.get(runtime_id);
    return value ? clone(value) : undefined;
  }

  async upsert(checkpoint: SignalTraderRuntimeCheckpoint) {
    this.data.set(checkpoint.runtime_id, clone(checkpoint));
  }

  async delete(runtime_id: string) {
    this.data.delete(runtime_id);
  }
}

export class InMemoryRuntimeAuditLogRepository implements RuntimeAuditLogRepository {
  private readonly data = new Map<string, SignalTraderRuntimeAuditLog[]>();

  async append(entry: SignalTraderRuntimeAuditLog) {
    const bucket = this.data.get(entry.runtime_id) ?? [];
    const next = clone({
      ...entry,
      seq: bucket.length + 1,
      created_at: entry.created_at ?? new Date().toISOString(),
    });
    bucket.push(next);
    this.data.set(entry.runtime_id, bucket);
    return clone(next);
  }

  async listByRuntime(runtime_id: string) {
    return (this.data.get(runtime_id) ?? []).map(clone);
  }
}

const mapRuntimeConfigRow = (row: Record<string, unknown>): SignalTraderRuntimeConfig => ({
  runtime_id: String(row.runtime_id),
  enabled: Boolean(row.enabled),
  execution_mode: row.execution_mode as SignalTraderRuntimeConfig['execution_mode'],
  account_id: String(row.account_id),
  subscription_id: String(row.subscription_id),
  investor_id: String(row.investor_id),
  signal_key: String(row.signal_key),
  product_id: String(row.product_id),
  vc_budget: Number(row.vc_budget),
  daily_burn_amount: Number(row.daily_burn_amount),
  subscription_status: row.subscription_status as SignalTraderRuntimeConfig['subscription_status'],
  contract_multiplier: Number(row.contract_multiplier ?? 1),
  lot_size: Number(row.lot_size ?? 1),
  profit_target_value: row.profit_target_value === null ? undefined : Number(row.profit_target_value),
  observer_backend: row.observer_backend as SignalTraderRuntimeConfig['observer_backend'],
  poll_interval_ms: Number(row.poll_interval_ms),
  reconciliation_interval_ms: Number(row.reconciliation_interval_ms),
  event_batch_size: Number(row.event_batch_size),
  allow_unsafe_mock: Boolean(row.allow_unsafe_mock ?? false),
  metadata: (row.metadata as Record<string, unknown>) ?? {},
  created_at: row.created_at ? String(row.created_at) : undefined,
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
});

const mapEventRow = (row: Record<string, unknown>): SignalTraderPersistedEvent => ({
  runtime_id: String(row.runtime_id),
  event_offset: Number(row.event_offset),
  event_id: String(row.event_id),
  event_type: row.event_type as DomainEvent['event_type'],
  schema_version: Number(row.schema_version),
  reducer_version: Number(row.reducer_version),
  idempotency_key: String(row.idempotency_key),
  command_fingerprint: row.command_fingerprint ? String(row.command_fingerprint) : undefined,
  created_at: Number(row.event_created_at_ms),
  event_created_at_ms: Number(row.event_created_at_ms),
  payload: row.payload as any,
  persisted_at: row.created_at ? String(row.created_at) : undefined,
});

const mapBindingRow = (row: Record<string, unknown>): SignalTraderOrderBinding => ({
  runtime_id: String(row.runtime_id),
  internal_order_id: String(row.internal_order_id),
  external_submit_order_id: row.external_submit_order_id ? String(row.external_submit_order_id) : undefined,
  external_operate_order_id: row.external_operate_order_id
    ? String(row.external_operate_order_id)
    : undefined,
  account_id: String(row.account_id),
  product_id: String(row.product_id),
  signal_id: String(row.signal_id),
  submit_effect_id: String(row.submit_effect_id),
  binding_status: row.binding_status as SignalTraderOrderBinding['binding_status'],
  observer_backend: row.observer_backend as SignalTraderOrderBinding['observer_backend'],
  first_submitted_at_ms: Number(row.first_submitted_at_ms),
  terminal_status_changed_at_ms:
    row.terminal_status_changed_at_ms === null ? undefined : Number(row.terminal_status_changed_at_ms),
  last_observed_source: row.last_observed_source ? String(row.last_observed_source) : undefined,
  last_observed_at_ms: row.last_observed_at_ms === null ? undefined : Number(row.last_observed_at_ms),
  last_report_id: row.last_report_id ? String(row.last_report_id) : undefined,
  last_error: row.last_error ? String(row.last_error) : undefined,
  created_at: row.created_at ? String(row.created_at) : undefined,
  updated_at: row.updated_at ? String(row.updated_at) : undefined,
});

const mapAuditLogRow = (row: Record<string, unknown>): SignalTraderRuntimeAuditLog => ({
  runtime_id: String(row.runtime_id),
  seq: Number(row.seq),
  action: row.action as SignalTraderRuntimeAuditLog['action'],
  operator: row.operator ? String(row.operator) : undefined,
  note: row.note ? String(row.note) : undefined,
  evidence: row.evidence ? String(row.evidence) : undefined,
  detail: (row.detail as Record<string, unknown>) ?? undefined,
  created_at: row.created_at ? String(row.created_at) : undefined,
});

export class SQLRuntimeConfigRepository implements RuntimeConfigRepository {
  constructor(private readonly terminal: Terminal) {}

  async upsert(config: SignalTraderRuntimeConfig) {
    const query = `INSERT INTO signal_trader_runtime_config (
      runtime_id, enabled, execution_mode, account_id, subscription_id, investor_id, signal_key, product_id,
      vc_budget, daily_burn_amount, subscription_status, contract_multiplier, lot_size, profit_target_value,
      observer_backend, poll_interval_ms, reconciliation_interval_ms,
      event_batch_size, allow_unsafe_mock, metadata
    ) VALUES (
      ${escapeSQL(config.runtime_id)}, ${escapeSQL(config.enabled)}, ${escapeSQL(
      config.execution_mode,
    )}, ${escapeSQL(config.account_id)},
      ${escapeSQL(config.subscription_id)}, ${escapeSQL(config.investor_id)}, ${escapeSQL(
      config.signal_key,
    )}, ${escapeSQL(config.product_id)},
      ${escapeSQL(config.vc_budget)}, ${escapeSQL(config.daily_burn_amount)}, ${escapeSQL(
      config.subscription_status,
    )},
      ${escapeSQL(config.contract_multiplier ?? 1)}, ${escapeSQL(config.lot_size ?? 1)}, ${escapeSQL(
      config.profit_target_value,
    )},
      ${escapeSQL(config.observer_backend)},
      ${escapeSQL(config.poll_interval_ms)}, ${escapeSQL(config.reconciliation_interval_ms)}, ${escapeSQL(
      config.event_batch_size,
    )},
      ${escapeSQL(config.allow_unsafe_mock ?? false)}, ${escapeSQL(config.metadata ?? {})}
    ) ON CONFLICT (runtime_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      execution_mode = EXCLUDED.execution_mode,
      account_id = EXCLUDED.account_id,
      subscription_id = EXCLUDED.subscription_id,
      investor_id = EXCLUDED.investor_id,
      signal_key = EXCLUDED.signal_key,
      product_id = EXCLUDED.product_id,
      vc_budget = EXCLUDED.vc_budget,
      daily_burn_amount = EXCLUDED.daily_burn_amount,
      subscription_status = EXCLUDED.subscription_status,
      contract_multiplier = EXCLUDED.contract_multiplier,
      lot_size = EXCLUDED.lot_size,
      profit_target_value = EXCLUDED.profit_target_value,
      observer_backend = EXCLUDED.observer_backend,
      poll_interval_ms = EXCLUDED.poll_interval_ms,
      reconciliation_interval_ms = EXCLUDED.reconciliation_interval_ms,
      event_batch_size = EXCLUDED.event_batch_size,
      allow_unsafe_mock = EXCLUDED.allow_unsafe_mock,
      metadata = EXCLUDED.metadata
    RETURNING *`;
    const [row] = await requestSQL<Record<string, unknown>[]>(this.terminal, query);
    return mapRuntimeConfigRow(row);
  }

  async get(runtime_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_runtime_config WHERE runtime_id = ${escapeSQL(runtime_id)} LIMIT 1`,
    );
    return rows[0] ? mapRuntimeConfigRow(rows[0]) : undefined;
  }

  async list() {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      'SELECT * FROM signal_trader_runtime_config ORDER BY updated_at DESC, runtime_id ASC',
    );
    return rows.map(mapRuntimeConfigRow);
  }

  async disable(runtime_id: string) {
    await requestSQL(
      this.terminal,
      `UPDATE signal_trader_runtime_config SET enabled = FALSE WHERE runtime_id = ${escapeSQL(runtime_id)}`,
    );
  }
}

export class SQLEventStore implements EventStore {
  constructor(private readonly terminal: Terminal) {}

  async append(runtime_id: string, events: DomainEvent[]) {
    if (events.length === 0) return [];
    const values = events
      .map(
        (event) => `(
        ${escapeSQL(runtime_id)}, ${escapeSQL(event.event_id)}, ${escapeSQL(event.event_type)}, ${escapeSQL(
          event.schema_version,
        )},
        ${escapeSQL(event.reducer_version)}, ${escapeSQL(event.idempotency_key)}, ${escapeSQL(
          event.command_fingerprint,
        )},
        ${escapeSQL(event.created_at)}, ${escapeSQL(event.payload)}
      )`,
      )
      .join(',');
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `INSERT INTO signal_trader_event (
        runtime_id, event_id, event_type, schema_version, reducer_version, idempotency_key, command_fingerprint, event_created_at_ms, payload
      ) VALUES ${values}
      ON CONFLICT (runtime_id, event_id) DO NOTHING
      RETURNING *`,
    );
    return rows.map(mapEventRow);
  }

  async list(runtime_id: string, options?: { after_offset?: number }) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_event WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} AND event_offset > ${escapeSQL(options?.after_offset ?? 0)} ORDER BY event_offset ASC`,
    );
    return rows.map(mapEventRow);
  }
}

export class SQLOrderBindingRepository implements OrderBindingRepository {
  constructor(private readonly terminal: Terminal) {}

  async upsert(binding: SignalTraderOrderBinding) {
    const query = buildInsertManyIntoTableSQL([binding], 'signal_trader_order_binding', {
      conflictKeys: ['runtime_id', 'internal_order_id'] as Array<keyof SignalTraderOrderBinding>,
      returningAll: true,
    });
    const [row] = await requestSQL<Record<string, unknown>[]>(this.terminal, query);
    return mapBindingRow(row);
  }

  async get(runtime_id: string, internal_order_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_order_binding WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} AND internal_order_id = ${escapeSQL(internal_order_id)} LIMIT 1`,
    );
    return rows[0] ? mapBindingRow(rows[0]) : undefined;
  }

  async getByExternalOperateOrderId(runtime_id: string, external_operate_order_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_order_binding WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} AND external_operate_order_id = ${escapeSQL(external_operate_order_id)} LIMIT 1`,
    );
    return rows[0] ? mapBindingRow(rows[0]) : undefined;
  }

  async listByRuntime(runtime_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_order_binding WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} ORDER BY updated_at DESC`,
    );
    return rows.map(mapBindingRow);
  }

  async listInFlight(runtime_id: string, product_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_order_binding WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} AND product_id = ${escapeSQL(
        product_id,
      )} AND binding_status IN ('submitted', 'accepted', 'partially_filled', 'unknown', 'timeout') ORDER BY updated_at DESC`,
    );
    return rows.map(mapBindingRow);
  }
}

export class SQLCheckpointRepository implements CheckpointRepository {
  constructor(private readonly terminal: Terminal) {}

  async get(runtime_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_runtime_checkpoint WHERE runtime_id = ${escapeSQL(runtime_id)} LIMIT 1`,
    );
    if (!rows[0]) return undefined;
    return {
      runtime_id: String(rows[0].runtime_id),
      last_event_offset: Number(rows[0].last_event_offset),
      last_event_id: String(rows[0].last_event_id),
      snapshot_json: rows[0].snapshot_json,
      snapshot_hash: String(rows[0].snapshot_hash),
      health_status: rows[0].health_status as SignalTraderRuntimeCheckpoint['health_status'],
      lock_reason: rows[0].lock_reason ? String(rows[0].lock_reason) : undefined,
      last_account_snapshot_at_ms:
        rows[0].last_account_snapshot_at_ms === null
          ? undefined
          : Number(rows[0].last_account_snapshot_at_ms),
      last_account_snapshot_status: rows[0].last_account_snapshot_status
        ? (String(
            rows[0].last_account_snapshot_status,
          ) as SignalTraderRuntimeCheckpoint['last_account_snapshot_status'])
        : undefined,
      last_matched_reconciliation_at_ms:
        rows[0].last_matched_reconciliation_at_ms === null
          ? undefined
          : Number(rows[0].last_matched_reconciliation_at_ms),
      last_matched_reconciliation_snapshot_id: rows[0].last_matched_reconciliation_snapshot_id
        ? String(rows[0].last_matched_reconciliation_snapshot_id)
        : undefined,
      updated_at: rows[0].updated_at ? String(rows[0].updated_at) : undefined,
    };
  }

  async upsert(checkpoint: SignalTraderRuntimeCheckpoint) {
    await requestSQL(
      this.terminal,
      `INSERT INTO signal_trader_runtime_checkpoint (
        runtime_id, last_event_offset, last_event_id, snapshot_json, snapshot_hash, health_status, lock_reason,
        last_account_snapshot_at_ms, last_account_snapshot_status,
        last_matched_reconciliation_at_ms, last_matched_reconciliation_snapshot_id
      ) VALUES (
        ${escapeSQL(checkpoint.runtime_id)}, ${escapeSQL(checkpoint.last_event_offset)}, ${escapeSQL(
        checkpoint.last_event_id,
      )}, ${escapeSQL(checkpoint.snapshot_json)}, ${escapeSQL(checkpoint.snapshot_hash)}, ${escapeSQL(
        checkpoint.health_status,
      )}, ${escapeSQL(checkpoint.lock_reason)}, ${escapeSQL(
        checkpoint.last_account_snapshot_at_ms,
      )}, ${escapeSQL(checkpoint.last_account_snapshot_status)}, ${escapeSQL(
        checkpoint.last_matched_reconciliation_at_ms,
      )}, ${escapeSQL(checkpoint.last_matched_reconciliation_snapshot_id)}
      ) ON CONFLICT (runtime_id) DO UPDATE SET
        last_event_offset = EXCLUDED.last_event_offset,
        last_event_id = EXCLUDED.last_event_id,
        snapshot_json = EXCLUDED.snapshot_json,
        snapshot_hash = EXCLUDED.snapshot_hash,
        health_status = EXCLUDED.health_status,
        lock_reason = EXCLUDED.lock_reason,
        last_account_snapshot_at_ms = EXCLUDED.last_account_snapshot_at_ms,
        last_account_snapshot_status = EXCLUDED.last_account_snapshot_status,
        last_matched_reconciliation_at_ms = EXCLUDED.last_matched_reconciliation_at_ms,
        last_matched_reconciliation_snapshot_id = EXCLUDED.last_matched_reconciliation_snapshot_id`,
    );
  }

  async delete(runtime_id: string) {
    await requestSQL(
      this.terminal,
      `DELETE FROM signal_trader_runtime_checkpoint WHERE runtime_id = ${escapeSQL(runtime_id)}`,
    );
  }
}

export class SQLRuntimeAuditLogRepository implements RuntimeAuditLogRepository {
  constructor(private readonly terminal: Terminal) {}

  async append(entry: SignalTraderRuntimeAuditLog) {
    const [row] = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `INSERT INTO signal_trader_runtime_audit_log (
        runtime_id, action, operator, note, evidence, detail
      ) VALUES (
        ${escapeSQL(entry.runtime_id)}, ${escapeSQL(entry.action)}, ${escapeSQL(entry.operator)}, ${escapeSQL(
        entry.note,
      )}, ${escapeSQL(entry.evidence)}, ${escapeSQL(entry.detail ?? {})}
      ) RETURNING *`,
    );
    return mapAuditLogRow(row);
  }

  async listByRuntime(runtime_id: string) {
    const rows = await requestSQL<Record<string, unknown>[]>(
      this.terminal,
      `SELECT * FROM signal_trader_runtime_audit_log WHERE runtime_id = ${escapeSQL(
        runtime_id,
      )} ORDER BY seq ASC, created_at ASC`,
    );
    return rows.map(mapAuditLogRow);
  }
}
