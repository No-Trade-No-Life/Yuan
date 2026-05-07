import { replayEvents } from './replay-events';
import { DomainEvent } from '../types/events';
import { EventSourcedTradingState } from '../types/snapshot';

export const appendEvents = (
  state: EventSourcedTradingState,
  events: DomainEvent[],
): EventSourcedTradingState => {
  const next_events = [...state.events, ...events];
  return {
    ...state,
    events: next_events,
    snapshot: replayEvents(next_events),
  };
};
