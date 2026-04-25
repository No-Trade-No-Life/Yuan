CREATE TABLE IF NOT EXISTS signal_trader_runtime_config (
  runtime_id TEXT PRIMARY KEY NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  execution_mode TEXT NOT NULL,
  account_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  investor_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  product_id TEXT NOT NULL,
  vc_budget DOUBLE PRECISION NOT NULL,
  daily_burn_amount DOUBLE PRECISION NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'active',
  contract_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1,
  lot_size DOUBLE PRECISION NOT NULL DEFAULT 1,
  profit_target_value DOUBLE PRECISION,
  secret_ref_kind TEXT,
  secret_ref_value TEXT,
  observer_backend TEXT NOT NULL,
  poll_interval_ms BIGINT NOT NULL DEFAULT 1000,
  reconciliation_interval_ms BIGINT NOT NULL DEFAULT 10000,
  event_batch_size INT NOT NULL DEFAULT 100,
  allow_unsafe_mock BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_trader_runtime_config_enabled ON signal_trader_runtime_config (enabled, updated_at);
CREATE INDEX IF NOT EXISTS idx_signal_trader_runtime_config_account_id ON signal_trader_runtime_config (account_id);

DROP TRIGGER IF EXISTS auto_update_updated_at_signal_trader_runtime_config ON signal_trader_runtime_config;
CREATE TRIGGER auto_update_updated_at_signal_trader_runtime_config
BEFORE UPDATE ON signal_trader_runtime_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
