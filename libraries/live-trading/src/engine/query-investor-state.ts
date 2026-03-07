import { ILiveTradingState, IQueryInvestorStateRequest } from '../types';

/** @public */
export const queryInvestorState = (
  state: ILiveTradingState,
  req: IQueryInvestorStateRequest,
): ILiveTradingState['investors'][string] | undefined => {
  const investor_state = state.investors[req.investor_id];
  if (!investor_state) return undefined;
  return deepClone(investor_state);
};

const deepClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};
