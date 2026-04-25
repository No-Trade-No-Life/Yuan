import { reduceEvents } from '../domain/reducer';
import { DomainEvent } from '../types/events';

export const replayEvents = (events: DomainEvent[]) => {
  return reduceEvents(events);
};
