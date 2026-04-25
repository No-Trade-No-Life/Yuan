import { DomainEvent } from '../types/events';
import { EventSourcedTradingState, QueryEventStreamRequest } from '../types/snapshot';

const eventRelatesTo = (event: DomainEvent, key: string, value: string) => {
  if (event.idempotency_key === value && key === 'idempotency_key') return true;
  const payload = event.payload as Record<string, unknown>;
  if (payload[key] === value) return true;
  if (Array.isArray(payload.subscription_ids) && key === 'subscription_id') {
    return payload.subscription_ids.includes(value);
  }
  if (Array.isArray(payload.attribution) && key === 'subscription_id') {
    return payload.attribution.some((item: any) => item.subscription_id === value);
  }
  return false;
};

export const queryEventStream = (state: EventSourcedTradingState, query: QueryEventStreamRequest) => {
  return state.events.filter((event) => {
    if (query.event_type && event.event_type !== query.event_type) return false;
    if (query.signal_id && !eventRelatesTo(event, 'signal_id', query.signal_id)) return false;
    if (query.subscription_id && !eventRelatesTo(event, 'subscription_id', query.subscription_id))
      return false;
    if (query.order_id && !eventRelatesTo(event, 'order_id', query.order_id)) return false;
    if (query.idempotency_key && event.idempotency_key !== query.idempotency_key) return false;
    return true;
  });
};
