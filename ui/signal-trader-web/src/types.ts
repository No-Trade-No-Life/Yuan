export type EnvProfile = 'paper' | 'dummy-live' | 'live';
export type RiskTier = EnvProfile;
export type RuntimeHealthStatus = 'normal' | 'degraded' | 'audit_only' | 'stopped';
export type SignalValue = -1 | 0 | 1;

export interface AppConfig {
  envProfile: EnvProfile;
  hostLabel: string;
  hostOrigin: string;
  enableMutation: boolean;
  defaultRuntimeId?: string;
}

export interface RuntimeConfig {
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
  observer_backend: string;
  poll_interval_ms: number;
  reconciliation_interval_ms: number;
  event_batch_size: number;
  allow_unsafe_mock?: boolean;
  metadata?: Record<string, unknown>;
  updated_at?: string;
}

export interface ProductProjection {
  product_id: string;
  current_net_qty: number;
  target_net_qty: number;
  pending_order_qty: number;
  attribution_map: Record<string, number>;
}

export interface SubscriptionProjection {
  subscription_id: string;
  investor_id: string;
  signal_key: string;
  product_id: string;
  status: 'active' | 'paused' | 'closed';
  vc_budget: number;
  released_vc_total: number;
  available_vc: number;
  funding_account: number;
  trading_account: number;
  precision_locked_amount: number;
  precision_lock_source_event_id?: string;
  daily_burn_amount: number;
  last_budget_eval_at: number;
  profit_target_value?: number;
  reserve_account_ref?: string;
  target_position_qty: number;
  settled_position_qty: number;
  last_signal_id?: string;
  last_entry_price?: number;
  last_effective_stop_loss_price?: number;
  contract_multiplier: number;
  lot_size: number;
}

export interface ReconciliationProjection {
  latest_snapshot_id?: string;
  account_id: string;
  projected_balance: number;
  rounded_projected_balance: number;
  observed_balance?: number;
  difference?: number;
  tolerance?: number;
  explanation?: string;
  status: 'idle' | 'matched' | 'mismatch';
}

export interface InvestorProjection {
  investor_id: string;
  subscription_ids: string[];
  active_subscription_ids: string[];
  subscription_count: number;
  active_subscription_count: number;
  total_released_vc: number;
  total_available_vc: number;
  total_funding_account: number;
  total_trading_account: number;
  total_precision_locked_amount: number;
  total_target_position_qty: number;
  total_settled_position_qty: number;
}

export interface SignalProjection {
  signal_key: string;
  subscription_ids: string[];
  product_ids: string[];
  subscription_count: number;
  active_subscription_count: number;
  total_released_vc: number;
  total_available_vc: number;
  total_funding_account: number;
  total_trading_account: number;
  total_precision_locked_amount: number;
  total_target_position_qty: number;
  total_settled_position_qty: number;
}

export interface ProjectionBundle {
  product?: ProductProjection;
  subscription?: SubscriptionProjection;
  reconciliation?: ReconciliationProjection;
  investor?: InvestorProjection;
  signal?: SignalProjection;
}

export interface ProjectionErrors {
  product?: string;
  subscription?: string;
  reconciliation?: string;
  investor?: string;
  signal?: string;
}

export interface ProjectionResourceState extends ResourceState<ProjectionBundle> {
  errors?: ProjectionErrors;
}

export interface LiveCapabilitySummary {
  key: string;
  observer_backend: string;
  supports_submit: boolean;
  supports_account_snapshot: boolean;
  evidence_source: string;
}

export interface RuntimeHealth {
  runtime_id: string;
  status: RuntimeHealthStatus;
  lock_reason?: string;
  last_error?: string;
  last_account_snapshot_at_ms?: number;
  last_account_snapshot_status?: 'fresh' | 'stale' | 'missing';
  last_matched_reconciliation_at_ms?: number;
  last_matched_reconciliation_snapshot_id?: string;
  updated_at: number;
}

export interface PersistedEvent {
  runtime_id: string;
  event_type: string;
  event_offset: number;
  event_created_at_ms: number;
  persisted_at?: string;
  payload?: unknown;
  signal_id?: string;
}

export interface AuditLogEntry {
  runtime_id: string;
  seq?: number;
  action: string;
  operator?: string;
  note?: string;
  evidence?: string;
  detail?: Record<string, unknown>;
  created_at?: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  next_cursor?: number;
}

export interface MockAccountPosition {
  position_id: string;
  product_id: string;
  direction?: string;
  volume: number;
  free_volume: number;
  position_price: number;
  current_price?: string;
  floating_profit: number;
  valuation: number;
}

export interface MockAccountInfo {
  account_id: string;
  money: {
    currency: string;
    equity: number;
    balance: number;
    profit: number;
    free: number;
    used: number;
  };
  positions: MockAccountPosition[];
  updated_at: number;
}

export interface WriteResponse {
  runtime_id: string;
  accepted: boolean;
  reason?: string;
  correlation_id: string;
}

export interface SubmitSignalFormState {
  signal: SignalValue;
  entryPrice: string;
  stopLossPrice: string;
  metadataText: string;
  runtimeConfirmation: string;
}

export interface ResourceState<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

export interface WorkspaceResources {
  health: ResourceState<RuntimeHealth>;
  projections: ProjectionResourceState;
  events: ResourceState<PersistedEvent[]>;
  audit: ResourceState<AuditLogResponse>;
  mockAccount: ResourceState<MockAccountInfo>;
}
