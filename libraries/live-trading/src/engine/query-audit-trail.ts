import { ILiveTradingState, IQueryAuditTrailRequest } from '../types';

/** @public */
export const queryAuditTrail = (state: ILiveTradingState, req: IQueryAuditTrailRequest) => {
  if (!req.investor_id) {
    return [];
  }

  if (req.from_ms > req.to_ms) {
    return [];
  }

  return state.audit_events
    .filter((event) => {
      if (event.created_at < req.from_ms || event.created_at > req.to_ms) return false;
      if (event.investor_id !== req.investor_id) return false;
      if (req.signal_id && event.signal_id !== req.signal_id) return false;
      return true;
    })
    .map((event) => deepClone(event));
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};
