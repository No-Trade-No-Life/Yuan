import { replayEvents } from './replay-events';
import { CreateEventSourcedTradingStateOptions, EventSourcedTradingState } from '../types/snapshot';

export const createEventSourcedTradingState = (
  options: CreateEventSourcedTradingStateOptions = {},
): EventSourcedTradingState => {
  const events = [...(options.events ?? [])];
  return {
    clock_ms: options.clock_ms ?? 0,
    events,
    snapshot: replayEvents(events),
  };
};
