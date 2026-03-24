export interface AttributionEntry {
  subscription_id: string;
  target_qty: number;
  allocation_rank: number;
}

export interface DomainEventBase<TType extends string, TPayload> {
  event_id: string;
  event_type: TType;
  schema_version: number;
  reducer_version: number;
  idempotency_key: string;
  command_fingerprint?: string;
  correlation_id?: string;
  causation_id?: string;
  created_at: number;
  payload: TPayload;
}

export type SubscriptionUpdatedEvent = DomainEventBase<
  'SubscriptionUpdated',
  {
    subscription_id: string;
    investor_id: string;
    signal_key: string;
    product_id: string;
    vc_budget: number;
    daily_burn_amount: number;
    profit_target_value?: number;
    signing_public_key?: string;
    reserve_account_ref?: string;
    status: 'active' | 'paused' | 'closed';
    effective_at: number;
    contract_multiplier: number;
    lot_size: number;
  }
>;

export type SignalReceivedEvent = DomainEventBase<
  'SignalReceived',
  {
    signal_id: string;
    signal_key: string;
    product_id: string;
    signal: -1 | 0 | 1;
    source: 'model' | 'manual' | 'agent';
    entry_price?: number;
    stop_loss_price?: number;
    upstream_emitted_at?: number;
    metadata?: Record<string, unknown>;
  }
>;

export type SignalForcedFlatHandledEvent = DomainEventBase<
  'SignalForcedFlatHandled',
  {
    signal_id: string;
    signal_key: string;
    product_id: string;
    subscription_ids: string[];
  }
>;

export type IntentCreatedEvent = DomainEventBase<
  'IntentCreated',
  {
    intent_id: string;
    subscription_id: string;
    signal_id: string;
    product_id: string;
    signal: -1 | 0 | 1;
    target_position_qty: number;
    entry_price?: number;
    stop_loss_price?: number;
    reason: 'open_or_rebalance' | 'forced_flat';
  }
>;

export type IntentRejectedEvent = DomainEventBase<
  'IntentRejected',
  {
    intent_id: string;
    subscription_id?: string;
    signal_id?: string;
    product_id?: string;
    reason:
      | 'missing_or_invalid_entry_or_stop_loss'
      | 'stop_loss_mutation_forbidden'
      | 'vc_insufficient'
      | 'subscription_not_found'
      | 'subscription_inactive'
      | 'duplicate_conflict'
      | 'unknown_execution_report'
      | 'unknown';
    detail?: string;
  }
>;

export type AlertTriggeredEvent = DomainEventBase<
  'AlertTriggered',
  {
    type:
      | 'risk_rejected'
      | 'order_rejected'
      | 'profit_target_reached'
      | 'idempotency_conflict'
      | 'unknown_execution_report'
      | 'reconciliation_mismatch';
    signal_id?: string;
    subscription_id?: string;
    order_id?: string;
    message?: string;
  }
>;

export type OrderSubmittedEvent = DomainEventBase<
  'OrderSubmitted',
  {
    order_id: string;
    signal_id: string;
    product_id: string;
    target_net_qty: number;
    current_net_qty: number;
    external_order_delta: number;
    attribution: AttributionEntry[];
    stop_loss_price?: number;
  }
>;

export type OrderAcceptedEvent = DomainEventBase<
  'OrderAccepted',
  {
    order_id: string;
    product_id: string;
    report_id: string;
  }
>;

export type OrderRejectedEvent = DomainEventBase<
  'OrderRejected',
  {
    order_id: string;
    product_id: string;
    report_id: string;
    reason?: string;
  }
>;

export type IntentReleasedEvent = DomainEventBase<
  'IntentReleased',
  {
    order_id: string;
    subscription_ids: string[];
    reason: 'order_rejected' | 'cancelled';
  }
>;

export type OrderFilledEvent = DomainEventBase<
  'OrderFilled',
  {
    order_id: string;
    product_id: string;
    report_id: string;
    status: 'partially_filled' | 'filled' | 'stop_triggered';
    fill_qty: number;
    cumulative_filled_qty: number;
    avg_fill_price: number;
    fee: number;
    attribution: AttributionEntry[];
  }
>;

export type ExecutionTimeoutObservedEvent = DomainEventBase<
  'ExecutionTimeoutObserved',
  {
    order_id: string;
    product_id: string;
    reason?: string;
  }
>;

export type MidPriceCapturedEvent = DomainEventBase<
  'MidPriceCaptured',
  {
    signal_id?: string;
    product_id: string;
    price: number;
    source: string;
    datasource_id?: string;
    quote_updated_at?: string;
  }
>;

export type InternalNettingSettledEvent = DomainEventBase<
  'InternalNettingSettled',
  {
    signal_id?: string;
    product_id: string;
    mid_price_event_id: string;
    attribution: AttributionEntry[];
    settled_qty: number;
  }
>;

export type AuthorizedAccountSnapshotCapturedEvent = DomainEventBase<
  'AuthorizedAccountSnapshotCaptured',
  {
    snapshot_id: string;
    account_id: string;
    balance: number;
    equity?: number;
    captured_at: number;
    metadata?: Record<string, unknown>;
  }
>;

export type ReconciliationMatchedEvent = DomainEventBase<
  'ReconciliationMatched',
  {
    snapshot_id: string;
    account_id: string;
    projected_balance: number;
    rounded_projected_balance: number;
    observed_balance: number;
    difference: number;
    tolerance: number;
    explanation: string;
  }
>;

export type ReconciliationMismatchDetectedEvent = DomainEventBase<
  'ReconciliationMismatchDetected',
  {
    snapshot_id: string;
    account_id: string;
    projected_balance: number;
    rounded_projected_balance: number;
    observed_balance: number;
    difference: number;
    tolerance: number;
    explanation: string;
  }
>;

export type AuditModeRestoredEvent = DomainEventBase<
  'AuditModeRestored',
  {
    recovery_id: string;
    account_id: string;
    restored_at: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
>;

export type DomainEvent =
  | SubscriptionUpdatedEvent
  | SignalReceivedEvent
  | SignalForcedFlatHandledEvent
  | IntentCreatedEvent
  | IntentRejectedEvent
  | AlertTriggeredEvent
  | OrderSubmittedEvent
  | OrderAcceptedEvent
  | OrderRejectedEvent
  | IntentReleasedEvent
  | OrderFilledEvent
  | ExecutionTimeoutObservedEvent
  | MidPriceCapturedEvent
  | InternalNettingSettledEvent
  | AuthorizedAccountSnapshotCapturedEvent
  | ReconciliationMatchedEvent
  | ReconciliationMismatchDetectedEvent
  | AuditModeRestoredEvent;
