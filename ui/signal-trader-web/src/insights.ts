import type { AuditLogEntry, PersistedEvent } from './types';

export interface FormalPriceInsight {
  price?: number;
  source?: string;
  datasourceId?: string;
  quoteUpdatedAt?: string;
  signalId?: string;
  createdAt?: number;
}

export interface NettingInsight {
  signalId?: string;
  settledQty?: number;
  attributionCount: number;
  createdAt?: number;
}

export interface AdvisoryInsight {
  message?: string;
  signalId?: string;
  createdAt?: number;
}

export interface QuoteIssueInsight {
  note?: string;
  createdAt?: string;
  detail?: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

const readNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const findLatestEvent = (events: PersistedEvent[], eventType: string) =>
  events.find((event) => event.event_type === eventType);

export const buildFormalPriceInsight = (events: PersistedEvent[]): FormalPriceInsight | undefined => {
  const event = findLatestEvent(events, 'MidPriceCaptured');
  if (!event) return undefined;
  const payload = asRecord(event.payload);
  return {
    price: readNumber(payload?.price),
    source: readString(payload?.source),
    datasourceId: readString(payload?.datasource_id),
    quoteUpdatedAt: readString(payload?.quote_updated_at),
    signalId: event.signal_id || readString(payload?.signal_id),
    createdAt: event.event_created_at_ms,
  };
};

export const buildNettingInsight = (events: PersistedEvent[]): NettingInsight | undefined => {
  const event = findLatestEvent(events, 'InternalNettingSettled');
  if (!event) return undefined;
  const payload = asRecord(event.payload);
  const attribution = Array.isArray(payload?.attribution) ? payload?.attribution : [];
  return {
    signalId: event.signal_id || readString(payload?.signal_id),
    settledQty: readNumber(payload?.settled_qty),
    attributionCount: attribution.length,
    createdAt: event.event_created_at_ms,
  };
};

export const buildProfitTargetInsight = (events: PersistedEvent[]): AdvisoryInsight | undefined => {
  const event = events.find((item) => {
    if (item.event_type !== 'AlertTriggered') return false;
    const payload = asRecord(item.payload);
    return payload?.type === 'profit_target_reached';
  });
  if (!event) return undefined;
  const payload = asRecord(event.payload);
  return {
    message: readString(payload?.message),
    signalId: event.signal_id || readString(payload?.signal_id),
    createdAt: event.event_created_at_ms,
  };
};

export const buildQuoteIssueInsight = (auditItems: AuditLogEntry[]): QuoteIssueInsight | undefined => {
  const entry = auditItems.find((item) => item.action === 'reference_price_missing');
  if (!entry) return undefined;
  return {
    note: entry.note,
    createdAt: entry.created_at,
    detail: entry.detail,
  };
};
