import { DomainCommand } from './commands';
import { AttributionEntry, DomainEvent } from './events';

export interface IdempotencyRecord {
  fingerprint: string;
  event_ids: string[];
}

export interface SubscriptionState {
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
  signing_public_key?: string;
  reserve_account_ref?: string;
  target_position_qty: number;
  settled_position_qty: number;
  last_signal_id?: string;
  last_intent_id?: string;
  last_effective_stop_loss_price?: number;
  last_entry_price?: number;
  contract_multiplier: number;
  lot_size: number;
}

export interface InvestorBufferAccount {
  investor_id: string;
  buffer_amount: number;
  precision_locked_amount: number;
  updated_at?: number;
  sources: Array<{
    source_subscription_id: string;
    amount: number;
    event_id: string;
    reason: 'precision_lock';
  }>;
}

export interface ProductExecutionProjection {
  product_id: string;
  current_net_qty: number;
  target_net_qty: number;
  pending_order_qty: number;
  attribution_map: Record<string, number>;
}

export interface OrderState {
  order_id: string;
  signal_id: string;
  product_id: string;
  status:
    | 'submitted'
    | 'accepted'
    | 'rejected'
    | 'cancelled'
    | 'partially_filled'
    | 'filled'
    | 'stop_triggered';
  target_net_qty: number;
  current_net_qty: number;
  external_order_delta: number;
  attribution: AttributionEntry[];
  stop_loss_price?: number;
  filled_qty: number;
  avg_fill_price?: number;
  fee_total: number;
}

export interface AuditProjection {
  event_ids: string[];
  latest_status: string;
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

export interface LiveTradingSnapshot {
  subscriptions: Record<string, SubscriptionState>;
  investor_buffers: Record<string, InvestorBufferAccount>;
  products: Record<string, ProductExecutionProjection>;
  orders: Record<string, OrderState>;
  audit_by_signal_id: Record<string, AuditProjection>;
  audit_by_subscription_id: Record<string, AuditProjection>;
  audit_by_order_id: Record<string, AuditProjection>;
  reconciliation: Record<string, ReconciliationProjection>;
  idempotency: Record<string, IdempotencyRecord>;
  mode: 'normal' | 'audit_only';
  last_event_at?: number;
}

export interface EventSourcedTradingState {
  clock_ms: number;
  events: DomainEvent[];
  snapshot: LiveTradingSnapshot;
}

export interface CreateEventSourcedTradingStateOptions {
  clock_ms?: number;
  events?: DomainEvent[];
}

export interface DispatchResult {
  appended_events: DomainEvent[];
  next_snapshot: LiveTradingSnapshot;
  next_state: EventSourcedTradingState;
  planned_effects: PlannedEffect[];
}

export type QueryProjectionRequest =
  | { type: 'subscription'; subscription_id: string }
  | { type: 'investor'; investor_id: string }
  | { type: 'product'; product_id: string }
  | { type: 'signal'; signal_key: string }
  | { type: 'audit_by_signal_id'; signal_id: string }
  | { type: 'audit_by_subscription_id'; subscription_id: string }
  | { type: 'audit_by_order_id'; order_id: string }
  | { type: 'reconciliation'; account_id: string };

export type QueryEventStreamRequest = {
  event_type?: DomainEvent['event_type'];
  signal_id?: string;
  subscription_id?: string;
  order_id?: string;
  idempotency_key?: string;
};

export interface PlaceOrderEffectPayload {
  effect_type: 'place_order';
  order_id: string;
  signal_id: string;
  product_id: string;
  size: number;
  stop_loss_price?: number;
  attribution: AttributionEntry[];
}

export interface ModifyOrderEffectPayload {
  effect_type: 'modify_order';
  order_id: string;
  product_id: string;
  next_size: number;
}

export interface CancelOrderEffectPayload {
  effect_type: 'cancel_order';
  order_id: string;
  product_id: string;
}

export type PlannedEffect = PlaceOrderEffectPayload | ModifyOrderEffectPayload | CancelOrderEffectPayload;

export type CommandFingerprintInput = DomainCommand | Record<string, unknown>;
