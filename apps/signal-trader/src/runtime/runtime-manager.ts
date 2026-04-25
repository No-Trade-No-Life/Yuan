import { createEventSourcedTradingState, queryEventStream, queryProjection } from '@yuants/signal-trader';
import { PaperExecutionAdapter } from '../execution/paper-execution-adapter';
import { hashSnapshot } from '../storage/repositories';
import {
  BackfillOrderBindingRequest,
  ExecutionAdapter,
  QueryEventStreamRequestByRuntime,
  QueryRuntimeAuditLogRequest,
  QueryRuntimeAuditLogResponse,
  QueryProjectionRequestByRuntime,
  RuntimeQuoteProvider,
  SignalTraderLiveCapabilityRegistry,
  RuntimeObserverProvider,
  RuntimeRepositories,
  SignalTraderRuntimeCheckpoint,
  SignalTraderRuntimeConfig,
  SignalTraderRuntimeHealth,
  SignalTraderRuntimeAuditLog,
  SignalTraderLiveCapabilitySummary,
  SignalTraderWriteResponse,
  SubmitSignalCommand,
  UnlockRuntimeRequest,
} from '../types';
import {
  buildLiveCapabilityAuditDetail,
  summarizeLiveCapabilityDescriptor,
  validateLiveCapabilityDescriptor,
} from './live-capability';
import { getSignalTraderTransferConfig, normalizeRuntimeConfig } from './runtime-config';
import { createRuntimeHealth } from './runtime-health';
import { RuntimeWorker } from './runtime-worker';
import { PaperClockController } from './paper-clock';

const EMPTY_RUNTIME_STATE = createEventSourcedTradingState();
const DEFAULT_RUNTIME_AUDIT_LOG_LIMIT = 50;
const MAX_RUNTIME_AUDIT_LOG_LIMIT = 200;
const MAX_AUDIT_TEXT_LENGTH = 512;
const MAX_AUDIT_DETAIL_DEPTH = 4;

const truncateAuditText = (value?: string) => {
  if (!value) return value;
  return value.length > MAX_AUDIT_TEXT_LENGTH ? `${value.slice(0, MAX_AUDIT_TEXT_LENGTH)}…` : value;
};

const sanitizeAuditDetail = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return truncateAuditText(value);
  if (depth >= MAX_AUDIT_DETAIL_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeAuditDetail(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeAuditDetail(item, depth + 1),
      ]),
    );
  }
  return value;
};

const sanitizeRuntimeAuditLog = (entry: SignalTraderRuntimeAuditLog): SignalTraderRuntimeAuditLog => ({
  ...entry,
  note: truncateAuditText(entry.note),
  evidence: truncateAuditText(entry.evidence),
  detail: sanitizeAuditDetail(entry.detail ?? {}) as Record<string, unknown>,
});

const buildStateFromCheckpoint = async (
  repositories: RuntimeRepositories,
  runtime_id: string,
  now_ms: number,
  force_full = false,
): Promise<{
  checkpoint?: SignalTraderRuntimeCheckpoint;
  state: ReturnType<typeof createEventSourcedTradingState>;
}> => {
  const checkpoint = force_full ? undefined : await repositories.checkpointRepository.get(runtime_id);
  const canReuseCheckpoint =
    checkpoint?.last_event_offset !== undefined &&
    checkpoint.snapshot_hash === hashSnapshot(checkpoint.snapshot_json);
  const persistedEvents = await repositories.eventStore.list(runtime_id, {
    after_offset: canReuseCheckpoint ? checkpoint.last_event_offset : 0,
  });
  const events = canReuseCheckpoint
    ? ([...(((checkpoint?.snapshot_json as any)?.events ?? []) as unknown[]), ...persistedEvents] as any)
    : persistedEvents;
  return {
    checkpoint,
    state: createEventSourcedTradingState({ events, clock_ms: now_ms }),
  };
};

export class RuntimeManager {
  private readonly workers = new Map<string, RuntimeWorker>();
  private readonly paperClock = new PaperClockController();

  private async syncPaperWorkersCapitalAllocation() {
    await Promise.all(
      [...this.workers.values()]
        .filter((worker) => worker.getRuntime().execution_mode === 'paper')
        .map((worker) => worker.syncPaperCapitalAllocation()),
    );
  }

  constructor(
    private readonly repositories: RuntimeRepositories,
    private readonly createExecutionAdapter: (runtime: SignalTraderRuntimeConfig) => ExecutionAdapter,
    private readonly observerProvider?: RuntimeObserverProvider,
    private readonly liveCapabilityRegistry?: SignalTraderLiveCapabilityRegistry,
    private readonly quoteProvider?: RuntimeQuoteProvider,
  ) {}

  async start() {
    const configs = await this.repositories.runtimeConfigRepository.list();
    for (const config of configs.filter((item) => item.enabled)) {
      await this.ensureWorker(config.runtime_id);
    }
  }

  dispose() {
    for (const worker of this.workers.values()) {
      worker.dispose();
    }
    this.workers.clear();
  }

  async upsertRuntimeConfig(input: SignalTraderRuntimeConfig): Promise<SignalTraderWriteResponse> {
    const config = normalizeRuntimeConfig(input);
    const saved = await this.repositories.runtimeConfigRepository.upsert(config);
    const existing = this.workers.get(saved.runtime_id);
    try {
      await this.validateLiveAdmission(saved, 'upsert');
    } catch (error) {
      existing?.dispose();
      this.workers.delete(saved.runtime_id);
      return {
        runtime_id: saved.runtime_id,
        accepted: false,
        reason: error instanceof Error ? error.message : 'LIVE_ADMISSION_REJECTED',
        correlation_id: `upsert:${saved.runtime_id}`,
      };
    }
    if (!saved.enabled) {
      if (existing) await existing.disable();
      return { runtime_id: saved.runtime_id, accepted: true, correlation_id: `upsert:${saved.runtime_id}` };
    }
    if (existing && existing.getRuntime().updated_at !== saved.updated_at) {
      existing.dispose();
      this.workers.delete(saved.runtime_id);
    }
    const worker = await this.ensureWorker(saved.runtime_id, saved);
    return {
      runtime_id: worker.getRuntime().runtime_id,
      accepted: true,
      correlation_id: `upsert:${saved.runtime_id}`,
    };
  }

  async listRuntimeConfig() {
    return this.repositories.runtimeConfigRepository.list();
  }

  async listLiveCapabilities(): Promise<SignalTraderLiveCapabilitySummary[]> {
    const descriptors = (await this.liveCapabilityRegistry?.list()) ?? [];
    return descriptors.map(summarizeLiveCapabilityDescriptor);
  }

  async getPaperClock() {
    return this.paperClock.getState();
  }

  async getMockAccountInfo(runtime_id: string) {
    const worker = await this.ensureWorker(runtime_id);
    if (worker.getRuntime().execution_mode !== 'paper') throw new Error('RUNTIME_NOT_FOUND');
    return worker.getMockAccountInfo();
  }

  async submitSignal(runtime_id: string, command: SubmitSignalCommand) {
    const worker = await this.ensureWorker(runtime_id);
    return worker.submitSignal(command);
  }

  async queryProjection(req: QueryProjectionRequestByRuntime) {
    const config = await this.repositories.runtimeConfigRepository.get(req.runtime_id);
    if (!config) throw new Error('RUNTIME_NOT_FOUND');
    const now_ms = this.paperClock.now(config.execution_mode);
    const { state } = await buildStateFromCheckpoint(this.repositories, req.runtime_id, now_ms);
    return queryProjection(state, req.query);
  }

  async queryEventStream(req: QueryEventStreamRequestByRuntime) {
    const config = await this.repositories.runtimeConfigRepository.get(req.runtime_id);
    if (!config) throw new Error('RUNTIME_NOT_FOUND');
    const { state } = await buildStateFromCheckpoint(
      this.repositories,
      req.runtime_id,
      this.paperClock.now(config.execution_mode),
    );
    const queriedEvents = queryEventStream(state, req.query);
    const persistedEvents = await this.repositories.eventStore.list(req.runtime_id);
    return persistedEvents.filter((item) =>
      queriedEvents.some((event: { event_id: string }) => event.event_id === item.event_id),
    );
  }

  async queryRuntimeAuditLog(req: QueryRuntimeAuditLogRequest): Promise<QueryRuntimeAuditLogResponse> {
    const config = await this.repositories.runtimeConfigRepository.get(req.runtime_id);
    if (!config) throw new Error('RUNTIME_NOT_FOUND');
    const limit = Math.min(
      Math.max(Math.trunc(req.limit ?? DEFAULT_RUNTIME_AUDIT_LOG_LIMIT), 1),
      MAX_RUNTIME_AUDIT_LOG_LIMIT,
    );
    const logs = await this.repositories.auditLogRepository.listByRuntime(req.runtime_id);
    const cursor = req.cursor;
    const filteredLogs = cursor !== undefined ? logs.filter((item) => (item.seq ?? 0) < cursor) : logs;
    const start = Math.max(filteredLogs.length - limit, 0);
    const page = filteredLogs.slice(start);
    return {
      items: [...page].reverse().map(sanitizeRuntimeAuditLog),
      next_cursor: start > 0 ? page[0]?.seq : undefined,
    };
  }

  async replayRuntime(runtime_id: string) {
    const worker = await this.ensureWorker(runtime_id);
    await worker.replay(true);
    return { runtime_id, accepted: true, correlation_id: `replay:${runtime_id}` };
  }

  async advancePaperClock(req: { delta_ms: number }) {
    const state = this.paperClock.advance(req.delta_ms);
    await this.syncPaperWorkersCapitalAllocation();
    return state;
  }

  async setPaperClockOffset(req: { offset_ms: number }) {
    const state = this.paperClock.setOffset(req.offset_ms);
    await this.syncPaperWorkersCapitalAllocation();
    return state;
  }

  async resetPaperClock() {
    const state = this.paperClock.reset();
    await this.syncPaperWorkersCapitalAllocation();
    return state;
  }

  async getRuntimeHealth(runtime_id: string): Promise<SignalTraderRuntimeHealth> {
    const worker = this.workers.get(runtime_id);
    if (worker) return worker.getHealth();
    const config = await this.repositories.runtimeConfigRepository.get(runtime_id);
    if (!config) throw new Error('RUNTIME_NOT_FOUND');
    const checkpoint = await this.repositories.checkpointRepository.get(runtime_id);
    if (checkpoint) {
      return createRuntimeHealth(runtime_id, {
        status: checkpoint.health_status,
        lock_reason: checkpoint.lock_reason,
        last_account_snapshot_at_ms: checkpoint.last_account_snapshot_at_ms,
        last_account_snapshot_status: checkpoint.last_account_snapshot_status,
        last_matched_reconciliation_at_ms: checkpoint.last_matched_reconciliation_at_ms,
        last_matched_reconciliation_snapshot_id: checkpoint.last_matched_reconciliation_snapshot_id,
      });
    }
    return createRuntimeHealth(runtime_id, { status: config.enabled ? 'stopped' : 'stopped' });
  }

  async disableRuntime(runtime_id: string) {
    await this.repositories.runtimeConfigRepository.disable(runtime_id);
    const worker = await this.ensureWorker(runtime_id);
    await worker.disable();
    return { runtime_id, accepted: true, correlation_id: `disable:${runtime_id}` };
  }

  async backfillOrderBinding(req: BackfillOrderBindingRequest) {
    const worker = await this.ensureWorker(req.runtime_id);
    return worker.backfillOrderBinding(req);
  }

  async unlockRuntime(req: UnlockRuntimeRequest) {
    const worker = await this.ensureWorker(req.runtime_id);
    return worker.unlock(req);
  }

  private async validateLiveAdmission(
    runtime: SignalTraderRuntimeConfig,
    phase: 'upsert' | 'boot',
  ): Promise<boolean> {
    if (runtime.execution_mode !== 'live') return true;
    let transfer;
    try {
      transfer = getSignalTraderTransferConfig(runtime);
    } catch {
      throw new Error('INVALID_SIGNAL_TRADER_TRANSFER_CONFIG');
    }
    if (transfer) {
      const runtimes = await this.repositories.runtimeConfigRepository.list();
      const conflicting = runtimes.find((item) => {
        if (item.runtime_id === runtime.runtime_id) return false;
        if (!item.enabled || item.execution_mode !== 'live') return false;
        try {
          const otherTransfer = getSignalTraderTransferConfig(item);
          return Boolean(
            otherTransfer &&
              (item.account_id === runtime.account_id ||
                (otherTransfer.funding_account_id === transfer.funding_account_id &&
                  otherTransfer.currency === transfer.currency)),
          );
        } catch {
          return false;
        }
      });
      if (conflicting) {
        throw new Error('TRANSFER_TRADING_ACCOUNT_CONFLICT');
      }
    }
    if (!this.liveCapabilityRegistry) {
      await writeCapabilityAuditLog(this.repositories, runtime, phase, {
        ok: false,
        reason: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
      });
      if (phase === 'upsert') {
        await persistStoppedCheckpoint(this.repositories, runtime, 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED');
      }
      return false;
    }
    const descriptor = await this.liveCapabilityRegistry.resolve({
      observer_backend: runtime.observer_backend,
      runtime,
    });
    const validation = validateLiveCapabilityDescriptor(runtime.observer_backend, descriptor);
    await writeCapabilityAuditLog(this.repositories, runtime, phase, validation);
    if (!validation.ok && phase === 'upsert') {
      await persistStoppedCheckpoint(this.repositories, runtime, validation.reason);
    }
    return validation.ok;
  }

  private async ensureWorker(runtime_id: string, preset?: SignalTraderRuntimeConfig) {
    const current = this.workers.get(runtime_id);
    if (current && (!preset || current.getRuntime().updated_at === preset.updated_at)) return current;
    const config = preset ?? (await this.repositories.runtimeConfigRepository.get(runtime_id));
    if (!config) throw new Error('RUNTIME_NOT_FOUND');
    current?.dispose();
    const worker = new RuntimeWorker(
      this.repositories,
      config,
      this.createExecutionAdapter(config),
      this.paperClock,
      this.observerProvider,
      this.liveCapabilityRegistry,
      this.quoteProvider,
    );
    await worker.boot();
    this.workers.set(runtime_id, worker);
    return worker;
  }
}

export const createDefaultExecutionAdapterFactory = (
  createLiveExecutionAdapter?: (runtime: SignalTraderRuntimeConfig) => ExecutionAdapter,
) => {
  const paper = new PaperExecutionAdapter();
  return (runtime: SignalTraderRuntimeConfig) => {
    if (runtime.execution_mode === 'paper') return paper;
    if (!createLiveExecutionAdapter) {
      return {
        execute: async () => ({
          commands: [],
          bindings: [],
          lock_reason: 'LIVE_EXECUTION_ADAPTER_NOT_CONFIGURED',
        }),
      } satisfies ExecutionAdapter;
    }
    return createLiveExecutionAdapter(runtime);
  };
};

const writeCapabilityAuditLog = async (
  repositories: RuntimeRepositories,
  runtime: SignalTraderRuntimeConfig,
  phase: 'upsert' | 'boot',
  validation:
    | ReturnType<typeof validateLiveCapabilityDescriptor>
    | {
        ok: false;
        reason: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED';
      },
) => {
  const entry: SignalTraderRuntimeAuditLog = {
    runtime_id: runtime.runtime_id,
    action: validation.ok ? 'live_capability_validated' : 'live_capability_rejected',
    note: validation.ok ? validation.descriptor.evidence_source : validation.reason,
    detail: validation.ok
      ? buildLiveCapabilityAuditDetail({
          observer_backend: runtime.observer_backend,
          phase,
          validation,
        })
      : validation.reason === 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED'
      ? {
          observer_backend: runtime.observer_backend,
          phase,
          validator_result: validation.reason,
        }
      : buildLiveCapabilityAuditDetail({
          observer_backend: runtime.observer_backend,
          phase,
          validation,
        }),
  };
  await repositories.auditLogRepository.append(entry);
};

const persistStoppedCheckpoint = async (
  repositories: RuntimeRepositories,
  runtime: SignalTraderRuntimeConfig,
  lock_reason: string,
) => {
  const checkpoint = await repositories.checkpointRepository.get(runtime.runtime_id);
  await repositories.checkpointRepository.upsert({
    runtime_id: runtime.runtime_id,
    last_event_offset: checkpoint?.last_event_offset ?? 0,
    last_event_id: checkpoint?.last_event_id ?? 'none',
    snapshot_json: checkpoint?.snapshot_json ?? { events: [], snapshot: EMPTY_RUNTIME_STATE.snapshot },
    snapshot_hash:
      checkpoint?.snapshot_hash ?? hashSnapshot({ events: [], snapshot: EMPTY_RUNTIME_STATE.snapshot }),
    health_status: 'stopped',
    lock_reason,
    last_account_snapshot_at_ms: checkpoint?.last_account_snapshot_at_ms,
    last_account_snapshot_status: checkpoint?.last_account_snapshot_status,
    last_matched_reconciliation_at_ms: checkpoint?.last_matched_reconciliation_at_ms,
    last_matched_reconciliation_snapshot_id: checkpoint?.last_matched_reconciliation_snapshot_id,
  });
};
