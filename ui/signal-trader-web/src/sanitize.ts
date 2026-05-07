import type {
  AuditLogEntry,
  InvestorProjection,
  PersistedEvent,
  ProductProjection,
  ReconciliationProjection,
  RuntimeConfig,
  SignalProjection,
  SubscriptionProjection,
} from './types';

const maskId = (value?: string) => {
  if (!value) return value;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const pick = (source: Record<string, unknown> | undefined, keys: string[]) =>
  Object.fromEntries(keys.filter((key) => source && key in source).map((key) => [key, source?.[key]]));

export const sanitizeRuntimeConfig = (runtime?: RuntimeConfig) => {
  if (!runtime) return undefined;
  return {
    runtime_id: runtime.runtime_id,
    execution_mode: runtime.execution_mode,
    account_id: maskId(runtime.account_id),
    investor_id: maskId(runtime.investor_id),
    signal_key: runtime.signal_key,
    product_id: runtime.product_id,
    vc_budget: runtime.vc_budget,
    daily_burn_amount: runtime.daily_burn_amount,
    subscription_status: runtime.subscription_status,
    observer_backend: runtime.observer_backend,
    metadata: runtime.metadata
      ? {
          has_transfer_config: Boolean(runtime.metadata.signal_trader_transfer),
          has_quote_config: Boolean(runtime.metadata.signal_trader_quote),
        }
      : undefined,
  };
};

export const sanitizeProductProjection = (projection?: ProductProjection) => {
  if (!projection) return undefined;
  return projection;
};

export const sanitizeSubscriptionProjection = (projection?: SubscriptionProjection) => {
  if (!projection) return undefined;
  return {
    ...projection,
    investor_id: maskId(projection.investor_id),
    reserve_account_ref: maskId(projection.reserve_account_ref),
    last_signal_id: maskId(projection.last_signal_id),
  };
};

export const sanitizeInvestorProjection = (projection?: InvestorProjection) => {
  if (!projection) return undefined;
  return {
    ...projection,
    investor_id: maskId(projection.investor_id),
    subscription_ids: projection.subscription_ids.map((value) => maskId(value)),
    active_subscription_ids: projection.active_subscription_ids.map((value) => maskId(value)),
  };
};

export const sanitizeSignalProjection = (projection?: SignalProjection) => {
  if (!projection) return undefined;
  return {
    ...projection,
    subscription_ids: projection.subscription_ids.map((value) => maskId(value)),
  };
};

export const sanitizeReconciliationProjection = (projection?: ReconciliationProjection) => {
  if (!projection) return undefined;
  return {
    ...projection,
    account_id: maskId(projection.account_id),
  };
};

export const sanitizeEventPayload = (event?: PersistedEvent) => {
  if (!event) return undefined;
  const payload = asRecord(event.payload);
  switch (event.event_type) {
    case 'MidPriceCaptured':
      return pick(payload, [
        'signal_id',
        'product_id',
        'price',
        'source',
        'datasource_id',
        'quote_updated_at',
      ]);
    case 'InternalNettingSettled':
      return pick(payload, ['signal_id', 'product_id', 'settled_qty', 'mid_price_event_id', 'attribution']);
    case 'AlertTriggered':
      return pick(payload, ['type', 'signal_id', 'message']);
    case 'ReconciliationMatched':
    case 'ReconciliationMismatchDetected':
      return {
        ...pick(payload, [
          'snapshot_id',
          'projected_balance',
          'rounded_projected_balance',
          'observed_balance',
          'difference',
          'tolerance',
          'explanation',
        ]),
        account_id: maskId(typeof payload?.account_id === 'string' ? payload.account_id : undefined),
      };
    default:
      return pick(payload, ['signal_id', 'product_id', 'subscription_id', 'order_id', 'reason']);
  }
};

export const sanitizeAuditDetail = (entry?: AuditLogEntry) => {
  if (!entry) return undefined;
  const detail = asRecord(entry.detail);
  return {
    note: entry.note,
    ...pick(detail, ['signal_id', 'product_id', 'direction', 'amount', 'reason', 'status', 'order_id']),
  };
};
