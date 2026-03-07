import { ILiveTradingState } from '../types';

/** @public */
export const createLiveTradingState = (seed?: Partial<ILiveTradingState>): ILiveTradingState => {
  const next = {
    schema_version: 'v1',
    investors: {},
    audit_events: [],
    processed_signals: {},
    next_event_seq: 1,
    next_effect_seq: 1,
    ...seed,
  };

  if (typeof structuredClone === 'function') {
    return structuredClone(next);
  }

  return JSON.parse(JSON.stringify(next)) as ILiveTradingState;
};
