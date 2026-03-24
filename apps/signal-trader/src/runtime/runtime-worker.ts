import {
  createEventSourcedTradingState,
  dispatchCommand,
  evaluateSubscriptionBudget,
  queryEventStream,
  queryProjection,
} from '@yuants/signal-trader';
import { encodePath } from '@yuants/utils';
import { normalizeObservation } from '../observer/observation-normalizer';
import { hashSnapshot } from '../storage/repositories';
import { PaperExecutionAdapter } from '../execution/paper-execution-adapter';
import {
  BackfillOrderBindingRequest,
  QueryEventStreamRequestByRuntime,
  QueryProjectionRequestByRuntime,
  RuntimeQuoteProvider,
  RuntimeObserverProvider,
  RuntimeRepositories,
  SignalTraderLiveCapabilityRegistry,
  SignalTraderReferencePriceEvidence,
  SignalTraderRuntimeCheckpoint,
  SignalTraderRuntimeConfig,
  SignalTraderRuntimeHealth,
  SignalTraderTransferConfig,
  SignalTraderTransferDirection,
  SignalTraderTransferOrder,
  SignalTraderWriteResponse,
  SubmitSignalCommand,
  TransferCapableExecutionAdapter,
  UnlockRuntimeRequest,
} from '../types';
import { buildLiveCapabilityAuditDetail, validateLiveCapabilityDescriptor } from './live-capability';
import { PaperClockController } from './paper-clock';
import { getSignalTraderTransferConfig } from './runtime-config';
import { createRuntimeHealth, updateRuntimeHealth } from './runtime-health';

const correlationId = (runtime_id: string, action: string, now_ms = Date.now()) =>
  encodePath('signal-trader', runtime_id, action, now_ms);
const TERMINAL_BINDING_STATUSES = new Set(['filled', 'cancelled', 'rejected']);
const IN_FLIGHT_BINDING_STATUSES = new Set([
  'submitted',
  'accepted',
  'partially_filled',
  'unknown',
  'timeout',
]);
const PLACE_ORDER_EFFECT = 'place_order';

const hasInFlightBinding = (bindings: Array<{ binding_status: string }>) =>
  bindings.some((item) => IN_FLIGHT_BINDING_STATUSES.has(item.binding_status));

const hasInFlightOrderState = (orders: Record<string, { status: string }>) =>
  Object.values(orders).some((order) => ['submitted', 'accepted', 'partially_filled'].includes(order.status));

const scheduleObserverTick = (callback: () => void, delay: number) => {
  const timer = setTimeout(callback, delay);
  timer.unref?.();
  return timer;
};

const toBindingStatus = (status: unknown) => {
  switch (status) {
    case 'accepted':
      return 'accepted' as const;
    case 'partially_filled':
      return 'partially_filled' as const;
    case 'filled':
      return 'filled' as const;
    case 'cancelled':
      return 'cancelled' as const;
    case 'rejected':
      return 'rejected' as const;
    default:
      return undefined;
  }
};

const summarizeEffects = (effects: unknown[]) =>
  effects.map((effect) => {
    const item = effect as {
      effect_type?: string;
      order_id?: string;
      signal_id?: string;
      product_id?: string;
      size?: number;
    };
    return {
      effect_type: item.effect_type,
      order_id: item.order_id,
      signal_id: item.signal_id,
      product_id: item.product_id,
      size: item.size,
    };
  });

const normalizeErrorDetail = (error: unknown) => {
  if (error instanceof Error) {
    return {
      error_name: error.name,
      error_message: error.message,
    };
  }
  return {
    error_name: 'UnknownError',
    error_message: typeof error === 'string' ? error : JSON.stringify(error),
  };
};

const round = (value: number) => Math.round(value * 1_000_000_000) / 1_000_000_000;

const hasPlaceOrderEffect = (effects: unknown[]) =>
  effects.some((item) => (item as { effect_type?: string }).effect_type === PLACE_ORDER_EFFECT);

const getTransferOrderDirection = (
  runtime: SignalTraderRuntimeConfig,
  transfer: SignalTraderTransferConfig,
  order: SignalTraderTransferOrder,
): SignalTraderTransferDirection | undefined => {
  if (
    order.credit_account_id === transfer.funding_account_id &&
    order.debit_account_id === runtime.account_id
  ) {
    return 'funding_to_trading';
  }
  if (
    order.credit_account_id === runtime.account_id &&
    order.debit_account_id === transfer.funding_account_id
  ) {
    return 'trading_to_funding';
  }
  return undefined;
};

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

export class RuntimeWorker {
  private state = createEventSourcedTradingState();
  private health: SignalTraderRuntimeHealth;
  private queue: Promise<unknown> = Promise.resolve();
  private observerTimer?: NodeJS.Timeout;
  private observerLoopActive = false;
  private observerInFlight = false;
  private observerTransferOutReadyCycles = 0;
  private transferInCooldownSnapshotUpdatedAt?: number;
  private transferOutCooldownSnapshotUpdatedAt?: number;

  constructor(
    private readonly repositories: RuntimeRepositories,
    private readonly runtime: SignalTraderRuntimeConfig,
    private readonly executionAdapter: {
      execute(runtime: SignalTraderRuntimeConfig, effects: unknown[]): Promise<any>;
    },
    private readonly paperClock: PaperClockController,
    private readonly observerProvider?: RuntimeObserverProvider,
    private readonly liveCapabilityRegistry?: SignalTraderLiveCapabilityRegistry,
    private readonly quoteProvider?: RuntimeQuoteProvider,
  ) {
    this.health = createRuntimeHealth(runtime.runtime_id);
  }

  private now() {
    return this.paperClock.now(this.runtime.execution_mode);
  }

  async boot() {
    await this.runExclusive(async () => {
      await this.replayInternal(false);
      if (!this.runtime.enabled) {
        await this.transitionHealth(
          { status: 'stopped', lock_reason: 'RUNTIME_DISABLED' },
          'disable_runtime',
        );
        return;
      }
      if (this.runtime.execution_mode === 'live' && !(await this.validateLiveCapability('boot'))) {
        return;
      }
      if ((this.state.events as unknown[]).length === 0) {
        await this.syncCanonicalSubscription();
      }
      if (this.state.snapshot.mode === 'audit_only' || this.health.status === 'audit_only') {
        await this.persistCheckpoint();
        this.startObserverLoop();
        return;
      }
      if (this.runtime.execution_mode === 'live' && !this.observerProvider) {
        await this.transitionHealth(
          { status: 'stopped', lock_reason: 'LIVE_OBSERVER_PROVIDER_NOT_CONFIGURED' },
          'runtime_locked',
        );
        return;
      }
      if (this.runtime.execution_mode === 'live') {
        try {
          await this.observeOnceInternal('boot');
        } catch (error) {
          await this.handleObserverFailure(error, 'boot');
          return;
        }
        if (this.health.status === 'stopped') {
          await this.persistCheckpoint();
          return;
        }
      } else {
        await this.syncPaperCapitalAllocationInternal();
      }
      await this.transitionHealth({ status: 'normal', lock_reason: undefined });
      this.startObserverLoop();
    });
  }

  async replay(force_full: boolean) {
    return this.runExclusive(async () => {
      await this.replayInternal(force_full);
      await this.persistCheckpoint();
      return this.state;
    });
  }

  getHealth() {
    return this.health;
  }

  getRuntime() {
    return this.runtime;
  }

  getMockAccountInfo() {
    if (!(this.executionAdapter instanceof PaperExecutionAdapter)) {
      throw new Error('PAPER_EXECUTION_ADAPTER_NOT_CONFIGURED');
    }
    return this.executionAdapter.getMockAccountInfo(this.runtime);
  }

  private sanitizeExternalSubmitSignalCommand(command: SubmitSignalCommand): SubmitSignalCommand {
    return {
      command_type: 'submit_signal',
      signal_id: command.signal_id,
      signal_key: command.signal_key,
      product_id: command.product_id,
      signal: command.signal,
      source: command.source,
      entry_price: command.entry_price,
      stop_loss_price: command.stop_loss_price,
      upstream_emitted_at: command.upstream_emitted_at,
      metadata: command.metadata,
    };
  }

  private async logReferencePrice(reason: string, detail: Record<string, unknown>) {
    await this.repositories.auditLogRepository.append({
      runtime_id: this.runtime.runtime_id,
      action: 'reference_price_missing',
      note: reason,
      detail,
    });
  }

  private withReferencePriceEvidence(
    command: SubmitSignalCommand,
    evidence?: SignalTraderReferencePriceEvidence,
  ): SubmitSignalCommand {
    if (!evidence) return command;
    return {
      ...command,
      reference_price: evidence.price,
      reference_price_source: evidence.source,
      reference_price_datasource_id: evidence.datasource_id,
      reference_price_updated_at: evidence.quote_updated_at,
    };
  }

  private async prepareSubmitSignalCommand(command: SubmitSignalCommand) {
    const sanitized = this.sanitizeExternalSubmitSignalCommand(command);
    if (!this.quoteProvider) {
      await this.logReferencePrice('QUOTE_PROVIDER_NOT_CONFIGURED', {
        signal_id: command.signal_id,
        product_id: command.product_id,
      });
      return sanitized;
    }
    try {
      const result = await this.quoteProvider.getLatestReferencePrice(this.runtime);
      if (!result.evidence) {
        await this.logReferencePrice(result.reason ?? 'QUOTE_MISSING', {
          signal_id: command.signal_id,
          product_id: command.product_id,
        });
        return sanitized;
      }
      return this.withReferencePriceEvidence(sanitized, result.evidence);
    } catch (error) {
      await this.logReferencePrice('QUOTE_QUERY_FAILED', {
        signal_id: command.signal_id,
        product_id: command.product_id,
        error: error instanceof Error ? error.message : String(error),
      });
      return sanitized;
    }
  }

  queryProjection(req: QueryProjectionRequestByRuntime) {
    return queryProjection({ ...this.state, clock_ms: this.now() }, req.query);
  }

  queryEventStream(req: QueryEventStreamRequestByRuntime) {
    return queryEventStream(this.state, req.query);
  }

  async submitSignal(command: SubmitSignalCommand): Promise<SignalTraderWriteResponse> {
    return this.runExclusive(async () => {
      const now_ms = this.now();
      if (!this.runtime.enabled) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'RUNTIME_DISABLED',
          correlation_id: correlationId(this.runtime.runtime_id, 'submit_signal_disabled', now_ms),
        };
      }
      if (command.signal_key !== this.runtime.signal_key || command.product_id !== this.runtime.product_id) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'RUNTIME_SIGNAL_SCOPE_MISMATCH',
          correlation_id: correlationId(this.runtime.runtime_id, 'submit_signal_scope_mismatch', now_ms),
        };
      }
      let plannedEffects: unknown[] = [];
      try {
        const preparedCommand = await this.prepareSubmitSignalCommand(command);
        const result = await this.appendCommand(preparedCommand, now_ms);
        plannedEffects = result.planned_effects as unknown[];
        if (this.executionAdapter instanceof PaperExecutionAdapter) {
          this.executionAdapter.setMockFillContext(this.runtime, {
            signal_id: command.signal_id,
            product_id: command.product_id,
            entry_price: preparedCommand.entry_price,
            reference_price: (preparedCommand as SubmitSignalCommand & { reference_price?: number })
              .reference_price,
          });
        }
        await this.ensurePreOrderTransferIn(plannedEffects, command.signal_id);
        await this.executeEffects(result.planned_effects as unknown[], {
          phase: 'execute_effects',
          signal_id: command.signal_id,
          now_ms,
        });
        if (this.runtime.execution_mode === 'paper') {
          await this.syncPaperCapitalAllocationInternal();
        }
      } catch (error) {
        if (this.runtime.execution_mode === 'live') {
          await this.failCloseExecutionError(
            {
              phase: plannedEffects.length > 0 ? 'execute_effects' : 'submit_signal',
              signal_id: command.signal_id,
              effects: plannedEffects,
            },
            error,
          );
          return {
            runtime_id: this.runtime.runtime_id,
            accepted: false,
            reason: this.health.lock_reason ?? this.health.status,
            correlation_id: correlationId(this.runtime.runtime_id, 'submit_signal_runtime_error', now_ms),
          };
        }
        throw error;
      }
      return {
        runtime_id: this.runtime.runtime_id,
        accepted: true,
        correlation_id: correlationId(this.runtime.runtime_id, 'submit_signal', now_ms),
      };
    });
  }

  async disable() {
    this.stopObserverLoop();
    await this.runExclusive(async () => {
      await this.transitionHealth({ status: 'stopped', lock_reason: 'RUNTIME_DISABLED' }, 'disable_runtime');
    });
  }

  dispose() {
    this.stopObserverLoop();
  }

  async observeOnce() {
    return this.runExclusive(async () => {
      await this.observeOnceInternal();
    });
  }

  private async syncPaperCapitalAllocationInternal() {
    if (this.runtime.execution_mode !== 'paper') return;
    const transfer = getSignalTraderTransferConfig(this.runtime);
    if (!transfer) return;
    const adapter = this.getTransferAdapter();
    if (!adapter?.queryTradingBalance || !adapter.submitTransfer || !adapter.pollTransfer) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const observedBalance = await adapter.queryTradingBalance(this.runtime);
    if (observedBalance.currency && observedBalance.currency !== transfer.currency) {
      throw new Error('TRANSFER_CURRENCY_MISMATCH');
    }
    const targetBalance = this.getTradingCapitalTarget(transfer);
    const deficit = round(targetBalance - observedBalance.balance);
    if (deficit > transfer.min_transfer_amount) {
      await this.resolveTransferOrder(transfer, 'funding_to_trading', deficit);
      return;
    }
    const excess = round(observedBalance.balance - targetBalance);
    if (excess > transfer.min_transfer_amount) {
      await this.resolveTransferOrder(transfer, 'trading_to_funding', excess);
    }
  }

  async syncPaperCapitalAllocation() {
    return this.runExclusive(async () => {
      await this.syncPaperCapitalAllocationInternal();
    });
  }

  async backfillOrderBinding(req: BackfillOrderBindingRequest) {
    return this.runExclusive(async () => {
      if (this.health.status !== 'audit_only') {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_ONLY_ALLOWED_IN_AUDIT_ONLY',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      if (!req.operator || !req.operator_note || !req.evidence) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_REQUIRES_OPERATOR_EVIDENCE',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      const existing = await this.repositories.orderBindingRepository.get(
        req.runtime_id,
        req.internal_order_id,
      );
      if (!existing) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BINDING_NOT_FOUND',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_missing'),
        };
      }
      const nextSubmitId = req.external_submit_order_id ?? existing.external_submit_order_id;
      const nextOperateId = req.external_operate_order_id ?? existing.external_operate_order_id;
      if (!req.external_submit_order_id && !req.external_operate_order_id && !req.binding_status) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_REQUIRES_PATCH',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      if (
        (req.external_submit_order_id && existing.external_submit_order_id) ||
        (req.external_operate_order_id && existing.external_operate_order_id)
      ) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_ONLY_FILLS_MISSING_EXTERNAL_ID',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      if (req.binding_status && !TERMINAL_BINDING_STATUSES.has(req.binding_status)) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_ONLY_ACCEPTS_TERMINAL_STATUS',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      if (
        req.binding_status &&
        existing.binding_status !== req.binding_status &&
        TERMINAL_BINDING_STATUSES.has(existing.binding_status)
      ) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'BACKFILL_FORBIDS_TERMINAL_STATUS_REWRITE',
          correlation_id: correlationId(this.runtime.runtime_id, 'backfill_rejected'),
        };
      }
      const updated = await this.repositories.orderBindingRepository.upsert({
        ...existing,
        external_submit_order_id: nextSubmitId,
        external_operate_order_id: nextOperateId,
        binding_status:
          req.binding_status && TERMINAL_BINDING_STATUSES.has(req.binding_status)
            ? req.binding_status
            : existing.binding_status,
        last_error: req.operator_note,
      });
      await this.repositories.auditLogRepository.append({
        runtime_id: this.runtime.runtime_id,
        action: 'backfill_order_binding',
        operator: req.operator,
        note: req.operator_note,
        evidence: req.evidence,
        detail: {
          audit_context: req.audit_context,
          internal_order_id: existing.internal_order_id,
          before: {
            external_submit_order_id: existing.external_submit_order_id,
            external_operate_order_id: existing.external_operate_order_id,
            binding_status: existing.binding_status,
          },
          after: {
            external_submit_order_id: updated.external_submit_order_id,
            external_operate_order_id: updated.external_operate_order_id,
            binding_status: updated.binding_status,
          },
        },
      });
      return {
        runtime_id: this.runtime.runtime_id,
        accepted: true,
        correlation_id: correlationId(this.runtime.runtime_id, 'backfill_binding'),
      };
    });
  }

  async unlock(req: UnlockRuntimeRequest) {
    return this.runExclusive(async () => {
      if (this.health.status !== 'audit_only') {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'RUNTIME_NOT_IN_AUDIT_ONLY',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      if (!req.operator || !req.operator_note || !req.evidence) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'UNLOCK_REQUIRES_OPERATOR_EVIDENCE',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      const bindings = await this.repositories.orderBindingRepository.listByRuntime(this.runtime.runtime_id);
      if (bindings.some((item) => !item.external_submit_order_id || !item.external_operate_order_id)) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'UNLOCK_BLOCKED_BY_MISSING_EXTERNAL_ID',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      if (hasInFlightBinding(bindings)) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'UNLOCK_BLOCKED_BY_IN_FLIGHT_BINDING',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      if (this.runtime.execution_mode === 'live' && !this.observerProvider) {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'UNLOCK_REQUIRES_OBSERVER_PROVIDER',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      if (this.runtime.execution_mode === 'live') {
        await this.observeOnceInternal();
        if (this.health.last_account_snapshot_status !== 'fresh' || !this.hasFreshMatchedReconciliation()) {
          return {
            runtime_id: this.runtime.runtime_id,
            accepted: false,
            reason: 'UNLOCK_REQUIRES_RECONCILIATION_MATCH',
            correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
          };
        }
      }
      if (this.state.snapshot.mode === 'audit_only') {
        const now_ms = this.now();
        await this.appendCommand(
          {
            command_type: 'restore_audit_mode',
            recovery_id: encodePath('restore-audit-mode', this.runtime.runtime_id, now_ms),
            account_id: this.runtime.account_id,
            restored_at: now_ms,
            reason: req.operator_note,
            metadata: {
              operator: req.operator,
              evidence: req.evidence,
              audit_context: req.audit_context,
            },
          },
          now_ms,
        );
      }
      if (this.state.snapshot.mode !== 'normal') {
        return {
          runtime_id: this.runtime.runtime_id,
          accepted: false,
          reason: 'UNLOCK_BLOCKED_BY_DOMAIN_AUDIT_ONLY',
          correlation_id: correlationId(this.runtime.runtime_id, 'unlock_rejected'),
        };
      }
      await this.repositories.auditLogRepository.append({
        runtime_id: this.runtime.runtime_id,
        action: 'unlock_runtime',
        operator: req.operator,
        note: req.operator_note,
        evidence: req.evidence,
        detail: {
          previous_lock_reason: this.health.lock_reason,
          audit_context: req.audit_context,
        },
      });
      await this.transitionHealth(
        {
          status: 'normal',
          lock_reason: undefined,
          last_error: undefined,
        },
        undefined,
      );
      return {
        runtime_id: this.runtime.runtime_id,
        accepted: true,
        correlation_id: correlationId(this.runtime.runtime_id, 'unlock_runtime'),
      };
    });
  }

  private startObserverLoop() {
    this.stopObserverLoop();
    if (this.runtime.execution_mode !== 'live' || !this.observerProvider) return;
    this.observerLoopActive = true;
    const tick = async () => {
      if (!this.observerLoopActive || this.observerInFlight) return;
      this.observerInFlight = true;
      try {
        await this.observeOnce();
      } catch (error) {
        await this.handleObserverFailure(error);
      } finally {
        this.observerInFlight = false;
        if (this.observerLoopActive) {
          this.observerTimer = scheduleObserverTick(() => {
            void tick();
          }, this.runtime.poll_interval_ms);
        }
      }
    };
    this.observerTimer = scheduleObserverTick(() => {
      void tick();
    }, this.runtime.poll_interval_ms);
  }

  private stopObserverLoop() {
    if (this.observerTimer) clearTimeout(this.observerTimer);
    this.observerTimer = undefined;
    this.observerLoopActive = false;
  }

  private async replayInternal(force_full: boolean) {
    const now_ms = this.now();
    const { checkpoint, state } = await buildStateFromCheckpoint(
      this.repositories,
      this.runtime.runtime_id,
      now_ms,
      force_full,
    );
    this.state = state;
    const checkpointStatus = checkpoint?.health_status;
    const lockReason = checkpoint?.lock_reason;
    const checkpointHealth = {
      last_account_snapshot_at_ms: checkpoint?.last_account_snapshot_at_ms,
      last_account_snapshot_status: checkpoint?.last_account_snapshot_status,
      last_matched_reconciliation_at_ms: checkpoint?.last_matched_reconciliation_at_ms,
      last_matched_reconciliation_snapshot_id: checkpoint?.last_matched_reconciliation_snapshot_id,
    };
    if (checkpointStatus === 'audit_only' || this.state.snapshot.mode === 'audit_only') {
      this.health = updateRuntimeHealth(this.health, {
        status: 'audit_only',
        lock_reason: lockReason ?? 'REPLAYED_AUDIT_ONLY_SNAPSHOT',
        ...checkpointHealth,
      });
      return this.state;
    }
    if (checkpointStatus === 'degraded') {
      this.health = updateRuntimeHealth(this.health, {
        status: 'degraded',
        lock_reason: lockReason,
        ...checkpointHealth,
      });
      return this.state;
    }
    if (checkpointStatus === 'stopped' || !this.runtime.enabled) {
      this.health = updateRuntimeHealth(this.health, {
        status: 'stopped',
        lock_reason: lockReason ?? 'RUNTIME_DISABLED',
        ...checkpointHealth,
      });
      return this.state;
    }
    this.health = updateRuntimeHealth(this.health, {
      status: 'normal',
      lock_reason: undefined,
      ...checkpointHealth,
    });
    return this.state;
  }

  private async observeOnceInternal(phase: 'boot' | 'runtime' = 'runtime') {
    if (this.runtime.execution_mode !== 'live' || !this.observerProvider) return;
    const now_ms = this.now();
    const bindings = await this.repositories.orderBindingRepository.listByRuntime(this.runtime.runtime_id);
    const previousMatchedSnapshotId = this.getMatchedReconciliationSnapshotId();
    const observation = await this.observerProvider.observe({ runtime: this.runtime, bindings });
    const accountSnapshotUpdatedAt = observation.account_snapshot
      ? Number(observation.account_snapshot.updated_at)
      : undefined;
    if (observation.account_snapshot) {
      const isFreshAccountSnapshot =
        Number.isFinite(accountSnapshotUpdatedAt) &&
        now_ms - Number(accountSnapshotUpdatedAt) <= this.runtime.reconciliation_interval_ms;
      if (!isFreshAccountSnapshot) {
        this.recordAccountSnapshotStatus(
          'stale',
          Number.isFinite(accountSnapshotUpdatedAt) ? accountSnapshotUpdatedAt : undefined,
        );
        await this.transitionHealth(
          {
            status: phase === 'boot' ? 'stopped' : 'audit_only',
            lock_reason: 'RECONCILIATION_SNAPSHOT_STALE',
            last_error: 'RECONCILIATION_SNAPSHOT_STALE',
          },
          'runtime_locked',
        );
        return;
      }
      this.recordAccountSnapshotStatus('fresh', accountSnapshotUpdatedAt);
    } else {
      this.recordAccountSnapshotStatus('missing');
    }
    if (observation.degraded_reason) {
      if (observation.degraded_reason === 'ORDER_HISTORY_SOURCE_UNAVAILABLE') {
        await this.transitionHealth(
          {
            status: phase === 'boot' ? 'stopped' : 'audit_only',
            lock_reason: 'ORDER_HISTORY_SOURCE_UNAVAILABLE',
            last_error: 'ORDER_HISTORY_SOURCE_UNAVAILABLE',
          },
          'runtime_locked',
        );
        return;
      }
      await this.transitionHealth(
        { status: phase === 'boot' ? 'stopped' : 'degraded', last_error: 'OBSERVER_DEGRADED' },
        'runtime_degraded',
      );
      if (phase === 'boot') return;
    }
    if (observation.lock_reason) {
      await this.transitionHealth(
        {
          status: phase === 'boot' ? 'stopped' : 'audit_only',
          lock_reason: observation.lock_reason,
          last_error: observation.lock_reason,
        },
        'runtime_locked',
      );
      return;
    }
    if (observation.account_snapshot && observation.account_snapshot.account_id !== this.runtime.account_id) {
      await this.transitionHealth(
        {
          status: phase === 'boot' ? 'stopped' : 'audit_only',
          lock_reason: 'AUTHORIZE_ORDER_ACCOUNT_MISMATCH',
          last_error: 'AUTHORIZE_ORDER_ACCOUNT_MISMATCH',
        },
        'runtime_locked',
      );
      return;
    }
    if (observation.account_snapshot && observation.observations.length === 0) {
      await this.appendCommand(
        {
          command_type: 'capture_authorized_account_snapshot',
          snapshot_id: encodePath(
            'account-snapshot',
            this.runtime.runtime_id,
            observation.account_snapshot.updated_at,
          ),
          account_id: observation.account_snapshot.account_id,
          balance: Number(observation.account_snapshot.money.balance),
          captured_at: observation.account_snapshot.updated_at,
          metadata: { source: 'observer' },
        },
        now_ms,
      );
    }
    for (const item of observation.observations) {
      const normalized = normalizeObservation({
        runtime: this.runtime,
        binding: item.binding,
        history_order: item.history_order,
        open_order: item.open_order,
        account_snapshot: observation.account_snapshot,
        now_ms,
      });
      if (normalized.lock_reason) {
        await this.transitionHealth(
          {
            status: phase === 'boot' ? 'stopped' : 'audit_only',
            lock_reason: normalized.lock_reason,
            last_error: normalized.lock_reason,
          },
          'runtime_locked',
        );
        return;
      }
      for (const command of normalized.commands) {
        await this.appendCommand(command, now_ms);
      }
      await this.syncBindingFromCommands(item.binding.internal_order_id, normalized.commands);
    }
    this.recordFreshMatchedReconciliation(previousMatchedSnapshotId, accountSnapshotUpdatedAt);
    if (!(await this.enforceReconciliationFreshnessGate(phase, now_ms))) {
      return;
    }
    if (observation.account_snapshot && Number.isFinite(accountSnapshotUpdatedAt)) {
      try {
        await this.syncLiveTradingCapitalAllocation(
          Number(accountSnapshotUpdatedAt),
          Number(observation.account_snapshot.money.balance),
          observation.account_snapshot.money.currency,
          hasInFlightOrderState(this.state.snapshot.orders),
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'TRANSFER_ERROR';
        await this.logTransfer('transfer_failed', {
          phase: 'observer_transfer_out',
          reason,
          ...normalizeErrorDetail(error),
        });
        await this.transitionHealth(
          {
            status: phase === 'boot' ? 'stopped' : 'audit_only',
            lock_reason: [
              'LIVE_TRANSFER_NOT_CONFIGURED',
              'TRANSFER_TIMEOUT',
              'TRANSFER_ERROR',
              'TRANSFER_CURRENCY_MISMATCH',
              'TRANSFER_ACTIVE_ORDER_CONFLICT',
            ].includes(reason)
              ? reason
              : 'TRANSFER_ERROR',
            last_error: [
              'LIVE_TRANSFER_NOT_CONFIGURED',
              'TRANSFER_TIMEOUT',
              'TRANSFER_ERROR',
              'TRANSFER_CURRENCY_MISMATCH',
              'TRANSFER_ACTIVE_ORDER_CONFLICT',
            ].includes(reason)
              ? reason
              : 'TRANSFER_ERROR',
          },
          'runtime_locked',
        );
        return;
      }
    } else {
      this.observerTransferOutReadyCycles = 0;
    }
    if (this.health.status === 'degraded' && !observation.degraded_reason) {
      this.health = updateRuntimeHealth(this.health, { status: 'normal', last_error: undefined });
    }
    await this.persistCheckpoint();
  }

  private async handleObserverFailure(error: unknown, phase: 'boot' | 'runtime' = 'runtime') {
    await this.runExclusive(async () => {
      await this.transitionHealth(
        { status: phase === 'boot' ? 'stopped' : 'degraded', last_error: 'OBSERVER_ERROR' },
        'runtime_degraded',
      );
    });
  }

  private async validateLiveCapability(phase: 'upsert' | 'boot') {
    if (!this.liveCapabilityRegistry) {
      await this.repositories.auditLogRepository.append({
        runtime_id: this.runtime.runtime_id,
        action: 'live_capability_rejected',
        note: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
        detail: {
          observer_backend: this.runtime.observer_backend,
          phase,
          validator_result: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
        },
      });
      await this.transitionHealth(
        {
          status: 'stopped',
          lock_reason: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
          last_error: 'LIVE_CAPABILITY_REGISTRY_NOT_CONFIGURED',
        },
        'runtime_locked',
      );
      return false;
    }
    const descriptor = await this.liveCapabilityRegistry.resolve({
      observer_backend: this.runtime.observer_backend,
      runtime: this.runtime,
    });
    const validation = validateLiveCapabilityDescriptor(this.runtime.observer_backend, descriptor);
    if (validation.ok) {
      await this.repositories.auditLogRepository.append({
        runtime_id: this.runtime.runtime_id,
        action: 'live_capability_validated',
        note: validation.descriptor.evidence_source,
        detail: buildLiveCapabilityAuditDetail({
          observer_backend: this.runtime.observer_backend,
          phase,
          validation,
        }),
      });
      return true;
    }
    await this.repositories.auditLogRepository.append({
      runtime_id: this.runtime.runtime_id,
      action: 'live_capability_rejected',
      note: validation.reason,
      detail: buildLiveCapabilityAuditDetail({
        observer_backend: this.runtime.observer_backend,
        phase,
        validation,
      }),
    });
    await this.transitionHealth(
      {
        status: 'stopped',
        lock_reason: validation.reason,
        last_error: validation.reason,
      },
      'runtime_locked',
    );
    return false;
  }

  private getMatchedReconciliationSnapshotId() {
    const reconciliation = this.state.snapshot.reconciliation[this.runtime.account_id];
    return reconciliation?.status === 'matched' ? reconciliation.latest_snapshot_id : undefined;
  }

  private recordAccountSnapshotStatus(
    status: NonNullable<SignalTraderRuntimeHealth['last_account_snapshot_status']>,
    updatedAt?: number,
  ) {
    this.health = updateRuntimeHealth(this.health, {
      last_account_snapshot_status: status,
      last_account_snapshot_at_ms: updatedAt,
    });
  }

  private recordFreshMatchedReconciliation(previousSnapshotId?: string, accountSnapshotUpdatedAt?: number) {
    const currentSnapshotId = this.getMatchedReconciliationSnapshotId();
    const needsBootstrap = !this.health.last_matched_reconciliation_at_ms;
    if (!currentSnapshotId || (!needsBootstrap && currentSnapshotId === previousSnapshotId)) return;
    this.health = updateRuntimeHealth(this.health, {
      last_matched_reconciliation_snapshot_id: currentSnapshotId,
      last_matched_reconciliation_at_ms: accountSnapshotUpdatedAt ?? this.now(),
    });
  }

  private hasMatchedReconciliation() {
    return !!this.getMatchedReconciliationSnapshotId();
  }

  private getReconciliationFreshnessFailureReason(now = this.now()) {
    if (this.runtime.execution_mode !== 'live') return undefined;
    const lastMatchedAt = this.health.last_matched_reconciliation_at_ms;
    if (!lastMatchedAt) return undefined;
    if (now - lastMatchedAt <= this.runtime.reconciliation_interval_ms) return undefined;
    if (this.health.last_account_snapshot_status === 'missing') {
      return 'RECONCILIATION_SNAPSHOT_MISSING';
    }
    return 'RECONCILIATION_STALE';
  }

  private async enforceReconciliationFreshnessGate(
    phase: 'boot' | 'runtime' = 'runtime',
    now_ms = this.now(),
  ) {
    const reason = this.getReconciliationFreshnessFailureReason(now_ms);
    if (!reason) return true;
    await this.transitionHealth(
      { status: phase === 'boot' ? 'stopped' : 'audit_only', lock_reason: reason, last_error: reason },
      'runtime_locked',
    );
    return false;
  }

  private hasFreshMatchedReconciliation() {
    return (
      this.hasMatchedReconciliation() &&
      !!this.health.last_matched_reconciliation_at_ms &&
      !this.getReconciliationFreshnessFailureReason()
    );
  }

  private async syncCanonicalSubscription() {
    const now_ms = this.now();
    await this.appendCommand(
      {
        command_type: 'upsert_subscription',
        subscription_id: this.runtime.subscription_id,
        investor_id: this.runtime.investor_id,
        signal_key: this.runtime.signal_key,
        product_id: this.runtime.product_id,
        vc_budget: this.runtime.vc_budget,
        daily_burn_amount: this.runtime.daily_burn_amount,
        profit_target_value: this.runtime.profit_target_value,
        status: this.runtime.subscription_status,
        effective_at: Date.parse(
          this.runtime.updated_at ?? this.runtime.created_at ?? new Date().toISOString(),
        ),
        reserve_account_ref: this.runtime.account_id,
        contract_multiplier: this.runtime.contract_multiplier,
        lot_size: this.runtime.lot_size,
      },
      now_ms,
    );
  }

  private async appendCommand(command: any, now_ms: number) {
    this.state.clock_ms = now_ms;
    const result = dispatchCommand(this.state, command);
    if (result.appended_events.length > 0) {
      await this.repositories.eventStore.append(this.runtime.runtime_id, result.appended_events);
      this.state = result.next_state;
      if (this.state.snapshot.mode === 'audit_only' && this.health.status !== 'audit_only') {
        const lockReason = result.appended_events.some(
          (event: { event_type: string }) => event.event_type === 'ReconciliationMismatchDetected',
        )
          ? 'RECONCILIATION_MISMATCH'
          : 'DOMAIN_AUDIT_ONLY_MODE';
        await this.transitionHealth(
          {
            status: 'audit_only',
            lock_reason: lockReason,
            last_error: lockReason,
          },
          'runtime_locked',
          false,
        );
      }
    }
    await this.persistCheckpoint();
    return result;
  }

  private async executeEffects(
    effects: unknown[],
    context: {
      phase: 'execute_effects' | 'submit_signal';
      signal_id?: string;
      now_ms: number;
    },
  ) {
    if (effects.length === 0) return;
    const execution = await this.executionAdapter.execute(this.runtime, effects);
    for (const binding of execution.bindings) {
      await this.repositories.orderBindingRepository.upsert(binding);
    }
    if (execution.degraded_reason) {
      await this.transitionHealth(
        { status: 'degraded', last_error: 'EXECUTION_DEGRADED' },
        'runtime_degraded',
      );
    }
    if (execution.lock_reason) {
      await this.transitionHealth(
        {
          status: 'audit_only',
          lock_reason: execution.lock_reason,
          last_error: execution.lock_reason,
        },
        'runtime_locked',
      );
      return;
    }
    for (const command of execution.commands) {
      await this.appendCommand(command, context.now_ms);
    }
    const internalOrderIds = execution.bindings.map(
      (item: { internal_order_id: string }) => item.internal_order_id,
    );
    for (const internalOrderId of internalOrderIds) {
      await this.syncBindingFromCommands(internalOrderId, execution.commands);
    }
  }

  private getTransferAdapter(): TransferCapableExecutionAdapter | undefined {
    return this.executionAdapter as TransferCapableExecutionAdapter;
  }

  private getTradingCapitalTarget(transfer: SignalTraderTransferConfig) {
    const subscription = this.state.snapshot.subscriptions[this.runtime.subscription_id];
    if (!subscription) {
      return Number(transfer.trading_buffer_amount ?? 0);
    }
    const budget = evaluateSubscriptionBudget(subscription, this.now());
    return round(
      Math.max(budget.trading_account, budget.current_reserved_vc + budget.precision_locked_amount) +
        Number(transfer.trading_buffer_amount ?? 0),
    );
  }

  private async logTransfer(
    action: 'transfer_submitted' | 'transfer_completed' | 'transfer_failed',
    detail: Record<string, unknown>,
  ) {
    await this.repositories.auditLogRepository.append({
      runtime_id: this.runtime.runtime_id,
      action,
      note:
        typeof detail.reason === 'string'
          ? detail.reason
          : typeof detail.direction === 'string'
          ? detail.direction
          : undefined,
      detail,
    });
  }

  private async resolveTransferOrder(
    transfer: SignalTraderTransferConfig,
    direction: SignalTraderTransferDirection,
    amount: number,
  ): Promise<SignalTraderTransferOrder> {
    const adapter = this.getTransferAdapter();
    if (!adapter?.findActiveTransfer || !adapter.submitTransfer || !adapter.pollTransfer) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const active = await adapter.findActiveTransfer(this.runtime, transfer);
    const activeDirection = active ? getTransferOrderDirection(this.runtime, transfer, active) : undefined;
    if (active && activeDirection !== direction) {
      const settledActive = await adapter.pollTransfer({
        runtime: this.runtime,
        transfer,
        order_id: active.order_id,
      });
      if (String(settledActive.status).toUpperCase() !== 'COMPLETE') {
        await this.logTransfer('transfer_failed', {
          direction,
          amount,
          order_id: settledActive.order_id,
          status: settledActive.status,
          error_message: settledActive.error_message,
        });
        throw new Error('TRANSFER_ERROR');
      }
    }
    const order =
      active && activeDirection === direction
        ? active
        : await adapter.submitTransfer({ runtime: this.runtime, transfer, direction, amount });
    if (!active || active.order_id !== order.order_id) {
      await this.logTransfer('transfer_submitted', {
        direction,
        amount,
        order_id: order.order_id,
        status: order.status,
      });
    }
    const settled = await adapter.pollTransfer({ runtime: this.runtime, transfer, order_id: order.order_id });
    if (String(settled.status).toUpperCase() === 'COMPLETE') {
      await this.logTransfer('transfer_completed', {
        direction,
        amount,
        order_id: settled.order_id,
        status: settled.status,
      });
      return settled;
    }
    await this.logTransfer('transfer_failed', {
      direction,
      amount,
      order_id: settled.order_id,
      status: settled.status,
      error_message: settled.error_message,
    });
    throw new Error('TRANSFER_ERROR');
  }

  private async ensurePreOrderTransferIn(effects: unknown[], signal_id: string) {
    if (!hasPlaceOrderEffect(effects)) return;
    const transfer = getSignalTraderTransferConfig(this.runtime);
    if (!transfer) return;
    const adapter = this.getTransferAdapter();
    if (!adapter?.queryTradingBalance) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const tradingBalance = await adapter.queryTradingBalance(this.runtime);
    if (tradingBalance.currency && tradingBalance.currency !== transfer.currency) {
      throw new Error('TRANSFER_CURRENCY_MISMATCH');
    }
    let observedBalance = tradingBalance.balance;
    const requiredBalance = this.getTradingCapitalTarget(transfer);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const deficit = round(requiredBalance - observedBalance);
      if (deficit <= transfer.min_transfer_amount) return;
      try {
        const settled = await this.resolveTransferOrder(transfer, 'funding_to_trading', deficit);
        observedBalance = round(observedBalance + Number(settled.expected_amount ?? deficit));
      } catch (error) {
        await this.logTransfer('transfer_failed', {
          phase: 'pre_order_transfer_in',
          signal_id,
          amount: deficit,
          reason: error instanceof Error ? error.message : 'TRANSFER_ERROR',
        });
        throw error;
      }
    }
    throw new Error('TRANSFER_ERROR');
  }

  private async syncLiveTradingCapitalAllocation(
    accountSnapshotUpdatedAt: number,
    _observedBalance: number,
    _observedCurrency: unknown,
    hasInFlightOrder: boolean,
  ) {
    const transfer = getSignalTraderTransferConfig(this.runtime);
    if (!transfer) {
      this.observerTransferOutReadyCycles = 0;
      return;
    }
    const adapter = this.getTransferAdapter();
    if (
      !adapter?.queryTradingBalance ||
      !adapter.findActiveTransfer ||
      !adapter.submitTransfer ||
      !adapter.pollTransfer
    ) {
      throw new Error('LIVE_TRANSFER_NOT_CONFIGURED');
    }
    const tradingBalance = await adapter.queryTradingBalance(this.runtime);
    const observedBalance = tradingBalance.balance;
    if (tradingBalance.currency && tradingBalance.currency !== transfer.currency) {
      throw new Error('TRANSFER_CURRENCY_MISMATCH');
    }
    const targetBalance = this.getTradingCapitalTarget(transfer);
    const deficit = round(targetBalance - observedBalance);
    if (deficit > transfer.min_transfer_amount) {
      if (
        this.transferInCooldownSnapshotUpdatedAt !== undefined &&
        accountSnapshotUpdatedAt <= this.transferInCooldownSnapshotUpdatedAt
      ) {
        return;
      }
      this.observerTransferOutReadyCycles = 0;
      await this.resolveTransferOrder(transfer, 'funding_to_trading', deficit);
      this.transferInCooldownSnapshotUpdatedAt = accountSnapshotUpdatedAt;
      return;
    }
    if (hasInFlightOrder) {
      this.observerTransferOutReadyCycles = 0;
      return;
    }
    if (
      this.transferOutCooldownSnapshotUpdatedAt !== undefined &&
      accountSnapshotUpdatedAt <= this.transferOutCooldownSnapshotUpdatedAt
    ) {
      return;
    }
    const excess = round(observedBalance - targetBalance);
    if (excess <= transfer.min_transfer_amount) {
      this.observerTransferOutReadyCycles = 0;
      return;
    }
    this.observerTransferOutReadyCycles += 1;
    if (this.observerTransferOutReadyCycles < 2) return;
    this.observerTransferOutReadyCycles = 0;
    await this.resolveTransferOrder(transfer, 'trading_to_funding', excess);
    this.transferOutCooldownSnapshotUpdatedAt = accountSnapshotUpdatedAt;
  }

  private async failCloseExecutionError(
    context: {
      phase: 'execute_effects' | 'submit_signal';
      signal_id?: string;
      effects?: unknown[];
    },
    error: unknown,
  ) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    const lock_reason = [
      'LIVE_TRANSFER_NOT_CONFIGURED',
      'TRANSFER_TIMEOUT',
      'TRANSFER_ERROR',
      'TRANSFER_CURRENCY_MISMATCH',
      'TRANSFER_ACTIVE_ORDER_CONFLICT',
    ].includes(String(errorMessage))
      ? String(errorMessage)
      : 'LIVE_EXECUTION_RUNTIME_ERROR';
    await this.transitionHealth(
      {
        status: 'audit_only',
        lock_reason,
        last_error: lock_reason,
      },
      'runtime_locked',
      true,
      {
        phase: context.phase,
        signal_id: context.signal_id,
        effects: context.effects ? summarizeEffects(context.effects) : undefined,
        ...normalizeErrorDetail(error),
      },
    );
  }

  private async syncBindingFromCommands(internal_order_id: string, commands: unknown[]) {
    const binding = await this.repositories.orderBindingRepository.get(
      this.runtime.runtime_id,
      internal_order_id,
    );
    if (!binding) return;
    for (const command of commands) {
      if ((command as { command_type?: string }).command_type !== 'apply_execution_report') continue;
      if ((command as { order_id?: string }).order_id !== internal_order_id) continue;
      const nextStatus = toBindingStatus((command as { status?: string }).status);
      if (!nextStatus) continue;
      await this.repositories.orderBindingRepository.upsert({
        ...binding,
        binding_status: nextStatus,
        terminal_status_changed_at_ms: (command as { reported_at?: number }).reported_at ?? this.now(),
        last_observed_at_ms: (command as { reported_at?: number }).reported_at ?? this.now(),
        last_observed_source:
          ((command as { raw_report?: { source?: string } }).raw_report?.source as string | undefined) ??
          binding.last_observed_source,
        last_report_id: (command as { report_id?: string }).report_id ?? binding.last_report_id,
      });
    }
  }

  private async transitionHealth(
    patch: Partial<SignalTraderRuntimeHealth>,
    auditAction?: 'runtime_locked' | 'runtime_degraded' | 'disable_runtime',
    persist = true,
    auditDetail?: Record<string, unknown>,
  ) {
    const previous = this.health;
    this.health = updateRuntimeHealth(this.health, patch);
    const healthChanged =
      previous.status !== this.health.status ||
      previous.lock_reason !== this.health.lock_reason ||
      previous.last_error !== this.health.last_error;
    if (auditAction && healthChanged) {
      await this.repositories.auditLogRepository.append({
        runtime_id: this.runtime.runtime_id,
        action: auditAction,
        note: this.health.last_error ?? this.health.lock_reason,
        detail: {
          status: this.health.status,
          lock_reason: this.health.lock_reason,
          ...auditDetail,
        },
      });
    }
    if (persist) await this.persistCheckpoint();
  }

  private async persistCheckpoint() {
    const events = await this.repositories.eventStore.list(this.runtime.runtime_id);
    const last = events[events.length - 1];
    const checkpoint: SignalTraderRuntimeCheckpoint = {
      runtime_id: this.runtime.runtime_id,
      last_event_offset: last?.event_offset ?? 0,
      last_event_id: last?.event_id ?? 'none',
      snapshot_json: { events, snapshot: this.state.snapshot },
      snapshot_hash: hashSnapshot({ events, snapshot: this.state.snapshot }),
      health_status: this.health.status,
      lock_reason: this.health.lock_reason,
      last_account_snapshot_at_ms: this.health.last_account_snapshot_at_ms,
      last_account_snapshot_status: this.health.last_account_snapshot_status,
      last_matched_reconciliation_at_ms: this.health.last_matched_reconciliation_at_ms,
      last_matched_reconciliation_snapshot_id: this.health.last_matched_reconciliation_snapshot_id,
    };
    await this.repositories.checkpointRepository.upsert(checkpoint);
  }

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
