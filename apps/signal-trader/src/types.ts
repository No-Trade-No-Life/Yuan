import { IAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import {
  ApplyExecutionReportCommand,
  CaptureAuthorizedAccountSnapshotCommand,
  DomainEvent,
  QueryEventStreamRequest,
  QueryProjectionRequest,
  SubmitSignalCommand,
} from '@yuants/signal-trader';

export type { SubmitSignalCommand };

export interface SignalTraderLiveCapabilityDescriptor {
  key: string;
  supports_submit: boolean;
  supports_cancel_by_external_operate_order_id: boolean;
  supports_closed_order_history: boolean;
  supports_open_orders: boolean;
  supports_account_snapshot: boolean;
  supports_authorize_order_account_check: boolean;
  evidence_source: string;
}

export interface SignalTraderLiveCapabilitySummary extends SignalTraderLiveCapabilityDescriptor {
  observer_backend: string;
  descriptor_hash: string;
}

export interface SignalTraderLiveCapabilityRegistry {
  list(): SignalTraderLiveCapabilityDescriptor[] | Promise<SignalTraderLiveCapabilityDescriptor[]>;
  resolve(input: {
    observer_backend: string;
    runtime?: SignalTraderRuntimeConfig;
  }):
    | SignalTraderLiveCapabilityDescriptor
    | undefined
    | Promise<SignalTraderLiveCapabilityDescriptor | undefined>;
}

export interface SignalTraderOperatorAuditContext {
  principal: string;
  display_name?: string;
  source?: string;
  request_id?: string;
  requested_operator?: string;
}

export interface SignalTraderRuntimeConfig {
  runtime_id: string;
  enabled: boolean;
  execution_mode: 'paper' | 'live';
  account_id: string;
  subscription_id: string;
  investor_id: string;
  signal_key: string;
  product_id: string;
  vc_budget: number;
  daily_burn_amount: number;
  subscription_status: 'active' | 'paused' | 'closed';
  contract_multiplier?: number;
  lot_size?: number;
  profit_target_value?: number;
  observer_backend: string;
  poll_interval_ms: number;
  reconciliation_interval_ms: number;
  event_batch_size: number;
  allow_unsafe_mock?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SignalTraderTransferConfig {
  funding_account_id: string;
  currency: string;
  min_transfer_amount: number;
  trading_buffer_amount: number;
}

export type SignalTraderTransferDirection = 'funding_to_trading' | 'trading_to_funding';

export interface SignalTraderTransferOrder {
  order_id: string;
  created_at: string;
  updated_at: string;
  credit_account_id: string;
  debit_account_id: string;
  currency: string;
  expected_amount: number;
  status: string;
  error_message?: string;
  runtime_id?: string;
}

export interface SignalTraderTradingBalance {
  balance: number;
  currency?: string;
}

export interface SignalTraderReferencePriceEvidence {
  product_id: string;
  price: number;
  source: string;
  datasource_id?: string;
  quote_updated_at?: string;
}

export interface SignalTraderReferencePriceLookupResult {
  evidence?: SignalTraderReferencePriceEvidence;
  reason?: 'QUOTE_MISSING' | 'QUOTE_INVALID' | 'QUOTE_AMBIGUOUS_DATASOURCE' | 'QUOTE_QUERY_FAILED';
}

export interface RuntimeQuoteProvider {
  getLatestReferencePrice(
    runtime: SignalTraderRuntimeConfig,
  ): Promise<SignalTraderReferencePriceLookupResult>;
}

export interface SignalTraderPaperClockState {
  real_now_ms: number;
  offset_ms: number;
  effective_now_ms: number;
}

export interface AdvancePaperClockRequest {
  delta_ms: number;
}

export interface SetPaperClockOffsetRequest {
  offset_ms: number;
}

export interface SignalTraderRuntimeHealth {
  runtime_id: string;
  status: 'normal' | 'degraded' | 'audit_only' | 'stopped';
  lock_reason?: string;
  last_error?: string;
  last_account_snapshot_at_ms?: number;
  last_account_snapshot_status?: 'fresh' | 'stale' | 'missing';
  last_matched_reconciliation_at_ms?: number;
  last_matched_reconciliation_snapshot_id?: string;
  updated_at: number;
}

export type SignalTraderPersistedEvent = DomainEvent & {
  runtime_id: string;
  event_offset: number;
  event_created_at_ms: number;
  persisted_at?: string;
};

export interface SignalTraderOrderBinding {
  runtime_id: string;
  internal_order_id: string;
  external_submit_order_id?: string;
  external_operate_order_id?: string;
  account_id: string;
  product_id: string;
  signal_id: string;
  submit_effect_id: string;
  binding_status:
    | 'submitted'
    | 'accepted'
    | 'partially_filled'
    | 'filled'
    | 'cancelled'
    | 'rejected'
    | 'unknown'
    | 'timeout';
  observer_backend: SignalTraderRuntimeConfig['observer_backend'];
  first_submitted_at_ms: number;
  terminal_status_changed_at_ms?: number;
  last_observed_source?: string;
  last_observed_at_ms?: number;
  last_report_id?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SignalTraderRuntimeCheckpoint {
  runtime_id: string;
  last_event_offset: number;
  last_event_id: string;
  snapshot_json: unknown;
  snapshot_hash: string;
  health_status: SignalTraderRuntimeHealth['status'];
  lock_reason?: string;
  last_account_snapshot_at_ms?: number;
  last_account_snapshot_status?: SignalTraderRuntimeHealth['last_account_snapshot_status'];
  last_matched_reconciliation_at_ms?: number;
  last_matched_reconciliation_snapshot_id?: string;
  updated_at?: string;
}

export interface SignalTraderRuntimeAuditLog {
  runtime_id: string;
  seq?: number;
  action:
    | 'runtime_locked'
    | 'runtime_degraded'
    | 'live_capability_validated'
    | 'live_capability_rejected'
    | 'backfill_order_binding'
    | 'unlock_runtime'
    | 'disable_runtime'
    | 'observer_cycle'
    | 'transfer_submitted'
    | 'transfer_completed'
    | 'transfer_failed'
    | 'reference_price_missing'
    | 'profit_target_flat_submitted'
    | 'profit_target_lifecycle_completed';
  operator?: string;
  note?: string;
  evidence?: string;
  detail?: Record<string, unknown>;
  created_at?: string;
}

export interface TypedCredential<T = unknown> {
  type: string;
  payload: T;
}

export interface SubmitOrderResult {
  external_submit_order_id?: string;
  external_operate_order_id?: string;
}

export interface LiveExecutionVenue<T = unknown> {
  authorizeOrder(input: { credential: TypedCredential<T>; effect: unknown }): Promise<{ account_id: string }>;
  submitOrder(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
    internal_order_id: string;
    signal_id: string;
    product_id: string;
    size: number;
    stop_loss_price?: number;
  }): Promise<SubmitOrderResult>;
  cancelOrder(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
    internal_order_id: string;
    external_operate_order_id: string;
    product_id: string;
  }): Promise<void>;
  queryTradingBalance?(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
  }): Promise<SignalTraderTradingBalance>;
  findActiveTransfer?(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
  }): Promise<SignalTraderTransferOrder | undefined>;
  submitTransfer?(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    direction: SignalTraderTransferDirection;
    amount: number;
  }): Promise<SignalTraderTransferOrder>;
  pollTransfer?(input: {
    credential: TypedCredential<T>;
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    order_id: string;
  }): Promise<SignalTraderTransferOrder>;
}

export interface LiveHistoryOrderRecord {
  order_id?: string;
  account_id: string;
  product_id: string;
  order_status?: string;
  traded_volume?: number | string;
  traded_price?: number | string;
  filled_at?: number | string;
  updated_at?: string;
}

export interface NormalizeObservationInput {
  runtime: SignalTraderRuntimeConfig;
  binding: SignalTraderOrderBinding;
  history_order?: LiveHistoryOrderRecord;
  open_order?: IOrder;
  account_snapshot?: Pick<IAccountInfo, 'account_id' | 'money' | 'updated_at'>;
  now_ms?: number;
}

export interface AdapterExecutionResult {
  commands: Array<ApplyExecutionReportCommand | CaptureAuthorizedAccountSnapshotCommand>;
  bindings: SignalTraderOrderBinding[];
  lock_reason?: string;
  degraded_reason?: string;
}

export interface SignalTraderWriteResponse {
  runtime_id: string;
  accepted: boolean;
  reason?: string;
  correlation_id: string;
}

export interface QueryProjectionRequestByRuntime {
  runtime_id: string;
  query: QueryProjectionRequest;
}

export interface QueryEventStreamRequestByRuntime {
  runtime_id: string;
  query: QueryEventStreamRequest;
}

export interface QueryRuntimeAuditLogRequest {
  runtime_id: string;
  limit?: number;
  cursor?: number;
}

export interface QueryRuntimeAuditLogResponse {
  items: SignalTraderRuntimeAuditLog[];
  next_cursor?: number;
}

export interface BackfillOrderBindingRequest {
  runtime_id: string;
  internal_order_id: string;
  external_submit_order_id?: string;
  external_operate_order_id?: string;
  binding_status?: SignalTraderOrderBinding['binding_status'];
  operator: string;
  operator_note: string;
  evidence: string;
  audit_context?: SignalTraderOperatorAuditContext;
}

export interface UnlockRuntimeRequest {
  runtime_id: string;
  operator: string;
  operator_note: string;
  evidence: string;
  audit_context?: SignalTraderOperatorAuditContext;
}

export interface RuntimeRepositories {
  runtimeConfigRepository: RuntimeConfigRepository;
  eventStore: EventStore;
  orderBindingRepository: OrderBindingRepository;
  checkpointRepository: CheckpointRepository;
  auditLogRepository: RuntimeAuditLogRepository;
}

export interface RuntimeConfigRepository {
  upsert(config: SignalTraderRuntimeConfig): Promise<SignalTraderRuntimeConfig>;
  get(runtime_id: string): Promise<SignalTraderRuntimeConfig | undefined>;
  list(): Promise<SignalTraderRuntimeConfig[]>;
  disable(runtime_id: string): Promise<void>;
}

export interface EventStore {
  append(runtime_id: string, events: DomainEvent[]): Promise<SignalTraderPersistedEvent[]>;
  list(runtime_id: string, options?: { after_offset?: number }): Promise<SignalTraderPersistedEvent[]>;
}

export interface OrderBindingRepository {
  upsert(binding: SignalTraderOrderBinding): Promise<SignalTraderOrderBinding>;
  get(runtime_id: string, internal_order_id: string): Promise<SignalTraderOrderBinding | undefined>;
  getByExternalOperateOrderId(
    runtime_id: string,
    external_operate_order_id: string,
  ): Promise<SignalTraderOrderBinding | undefined>;
  listByRuntime(runtime_id: string): Promise<SignalTraderOrderBinding[]>;
  listInFlight(runtime_id: string, product_id: string): Promise<SignalTraderOrderBinding[]>;
}

export interface CheckpointRepository {
  get(runtime_id: string): Promise<SignalTraderRuntimeCheckpoint | undefined>;
  upsert(checkpoint: SignalTraderRuntimeCheckpoint): Promise<void>;
  delete(runtime_id: string): Promise<void>;
}

export interface RuntimeAuditLogRepository {
  append(entry: SignalTraderRuntimeAuditLog): Promise<SignalTraderRuntimeAuditLog>;
  listByRuntime(runtime_id: string): Promise<SignalTraderRuntimeAuditLog[]>;
}

export interface RuntimeObserverObservation {
  binding: SignalTraderOrderBinding;
  history_order?: LiveHistoryOrderRecord;
  open_order?: IOrder;
}

export interface RuntimeObserverResult {
  observations: RuntimeObserverObservation[];
  account_snapshot?: Pick<IAccountInfo, 'account_id' | 'money' | 'updated_at'>;
  degraded_reason?: string;
  lock_reason?: string;
}

export interface RuntimeObserverProvider {
  observe(input: {
    runtime: SignalTraderRuntimeConfig;
    bindings: SignalTraderOrderBinding[];
  }): Promise<RuntimeObserverResult>;
}

export interface ExecutionAdapter {
  execute(runtime: SignalTraderRuntimeConfig, effects: unknown[]): Promise<AdapterExecutionResult>;
}

export interface TransferCapableExecutionAdapter extends ExecutionAdapter {
  queryTradingBalance?(runtime: SignalTraderRuntimeConfig): Promise<SignalTraderTradingBalance>;
  findActiveTransfer?(
    runtime: SignalTraderRuntimeConfig,
    transfer: SignalTraderTransferConfig,
  ): Promise<SignalTraderTransferOrder | undefined>;
  submitTransfer?(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    direction: SignalTraderTransferDirection;
    amount: number;
  }): Promise<SignalTraderTransferOrder>;
  pollTransfer?(input: {
    runtime: SignalTraderRuntimeConfig;
    transfer: SignalTraderTransferConfig;
    order_id: string;
  }): Promise<SignalTraderTransferOrder>;
}

export interface SignalTraderServiceHandlers {
  upsertRuntimeConfig(req: SignalTraderRuntimeConfig): Promise<SignalTraderWriteResponse>;
  listRuntimeConfig(): Promise<SignalTraderRuntimeConfig[]>;
  listLiveCapabilities(): Promise<SignalTraderLiveCapabilitySummary[]>;
  getPaperClock(): Promise<SignalTraderPaperClockState>;
  getMockAccountInfo(req: { runtime_id: string }): Promise<IAccountInfo>;
  submitSignal(req: { runtime_id: string; command: SubmitSignalCommand }): Promise<SignalTraderWriteResponse>;
  queryProjection(req: QueryProjectionRequestByRuntime): Promise<unknown>;
  queryEventStream(req: QueryEventStreamRequestByRuntime): Promise<SignalTraderPersistedEvent[]>;
  queryRuntimeAuditLog(req: QueryRuntimeAuditLogRequest): Promise<QueryRuntimeAuditLogResponse>;
  replayRuntime(req: { runtime_id: string }): Promise<SignalTraderWriteResponse>;
  advancePaperClock(req: AdvancePaperClockRequest): Promise<SignalTraderPaperClockState>;
  setPaperClockOffset(req: SetPaperClockOffsetRequest): Promise<SignalTraderPaperClockState>;
  resetPaperClock(): Promise<SignalTraderPaperClockState>;
  getRuntimeHealth(req: { runtime_id: string }): Promise<SignalTraderRuntimeHealth>;
  disableRuntime(req: { runtime_id: string }): Promise<SignalTraderWriteResponse>;
  backfillOrderBinding(req: BackfillOrderBindingRequest): Promise<SignalTraderWriteResponse>;
  unlockRuntime(req: UnlockRuntimeRequest): Promise<SignalTraderWriteResponse>;
}

export interface SignalTraderServicePolicy {
  allowAnonymousRead?: boolean;
  enableMutatingServices?: boolean;
  enableOperatorServices?: boolean;
  enablePaperClockServices?: boolean;
  authorizeRead?: (input: { serviceName: string; request: unknown }) => Promise<boolean> | boolean;
  authorize?: (input: { serviceName: string; request: unknown }) => Promise<boolean> | boolean;
  resolveOperatorAuditContext?: (input: {
    serviceName: string;
    request: unknown;
  }) => Promise<SignalTraderOperatorAuditContext | undefined> | SignalTraderOperatorAuditContext | undefined;
}
