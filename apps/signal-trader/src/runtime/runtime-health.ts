import { SignalTraderRuntimeHealth } from '../types';

export const createRuntimeHealth = (
  runtime_id: string,
  overrides: Partial<SignalTraderRuntimeHealth> = {},
): SignalTraderRuntimeHealth => ({
  runtime_id,
  status: 'stopped',
  updated_at: Date.now(),
  ...overrides,
});

export const updateRuntimeHealth = (
  current: SignalTraderRuntimeHealth,
  patch: Partial<SignalTraderRuntimeHealth>,
): SignalTraderRuntimeHealth => ({
  ...current,
  ...patch,
  updated_at: Date.now(),
});
