import { SignalTraderRuntimeConfig, SignalTraderTransferConfig } from '../types';

export interface SignalTraderQuoteConfig {
  datasource_id?: string;
}

const assertPositiveInteger = (value: number, field: string) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
};

export const normalizeRuntimeConfig = (input: SignalTraderRuntimeConfig): SignalTraderRuntimeConfig => {
  const config: SignalTraderRuntimeConfig = {
    ...input,
    contract_multiplier: input.contract_multiplier ?? 1,
    lot_size: input.lot_size ?? 1,
    poll_interval_ms: input.poll_interval_ms ?? 1000,
    reconciliation_interval_ms: input.reconciliation_interval_ms ?? 10_000,
    event_batch_size: input.event_batch_size ?? 100,
    metadata: input.metadata ?? {},
  };

  if (!config.runtime_id) throw new Error('INVALID_RUNTIME_ID');
  if (config.subscription_id !== config.runtime_id) throw new Error('SUBSCRIPTION_ID_MUST_EQUAL_RUNTIME_ID');
  if (!config.account_id) throw new Error('INVALID_ACCOUNT_ID');
  if (!config.signal_key) throw new Error('INVALID_SIGNAL_KEY');
  if (!config.product_id) throw new Error('INVALID_PRODUCT_ID');
  if (!config.investor_id) throw new Error('INVALID_INVESTOR_ID');
  if (config.vc_budget <= 0) throw new Error('INVALID_VC_BUDGET');
  if (config.daily_burn_amount < 0) throw new Error('INVALID_DAILY_BURN_AMOUNT');

  assertPositiveInteger(config.poll_interval_ms, 'poll_interval_ms');
  assertPositiveInteger(config.reconciliation_interval_ms, 'reconciliation_interval_ms');
  assertPositiveInteger(config.event_batch_size, 'event_batch_size');

  if (config.execution_mode === 'paper') {
    if (config.observer_backend !== 'paper_simulated') {
      throw new Error('PAPER_REQUIRES_PAPER_SIMULATED_OBSERVER');
    }
    return config;
  }

  if (!config.observer_backend?.trim()) {
    throw new Error('LIVE_REQUIRES_OBSERVER_BACKEND');
  }
  if (config.observer_backend === 'paper_simulated') {
    throw new Error('LIVE_FORBIDS_PAPER_SIMULATED_OBSERVER');
  }
  if (config.allow_unsafe_mock) {
    throw new Error('LIVE_FORBIDS_UNSAFE_MOCK');
  }
  return config;
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const getSignalTraderTransferConfig = (
  runtime: SignalTraderRuntimeConfig,
): SignalTraderTransferConfig | undefined => {
  const candidate = runtime.metadata?.signal_trader_transfer;
  if (!candidate || typeof candidate !== 'object') return undefined;
  const record = candidate as Record<string, unknown>;
  if (typeof record.funding_account_id !== 'string' || !record.funding_account_id.trim()) {
    throw new Error('INVALID_SIGNAL_TRADER_TRANSFER_CONFIG');
  }
  if (typeof record.currency !== 'string' || !record.currency.trim()) {
    throw new Error('INVALID_SIGNAL_TRADER_TRANSFER_CONFIG');
  }
  if (record.funding_account_id === runtime.account_id) {
    throw new Error('INVALID_SIGNAL_TRADER_TRANSFER_CONFIG');
  }
  const min_transfer_amount = Math.max(0, toFiniteNumber(record.min_transfer_amount, 0));
  const trading_buffer_amount = Math.max(0, toFiniteNumber(record.trading_buffer_amount, 0));
  return {
    funding_account_id: record.funding_account_id,
    currency: record.currency,
    min_transfer_amount,
    trading_buffer_amount,
  };
};

export const getSignalTraderQuoteConfig = (
  runtime: SignalTraderRuntimeConfig,
): SignalTraderQuoteConfig | undefined => {
  const candidate = runtime.metadata?.signal_trader_quote;
  if (!candidate || typeof candidate !== 'object') return undefined;
  const record = candidate as Record<string, unknown>;
  if (record.datasource_id !== undefined && typeof record.datasource_id !== 'string') {
    throw new Error('INVALID_SIGNAL_TRADER_QUOTE_CONFIG');
  }
  return {
    datasource_id:
      typeof record.datasource_id === 'string' && record.datasource_id.trim()
        ? record.datasource_id
        : undefined,
  };
};
