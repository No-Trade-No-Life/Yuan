import { StrategyFunction } from './types';

export const strategyRegistry = new Map<string, StrategyFunction>();

export const addStrategy = (name: string, strategyFn: StrategyFunction, schema = {}) => {
  if (strategyRegistry.has(name)) {
    throw `StrategyAlreadyExists: ${name}`;
  }
  strategyRegistry.set(name, strategyFn);
};
