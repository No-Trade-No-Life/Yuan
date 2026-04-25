CREATE TABLE IF NOT EXISTS signal_trader_order_binding (
  runtime_id TEXT NOT NULL,
  internal_order_id TEXT NOT NULL,
  external_submit_order_id TEXT,
  external_operate_order_id TEXT,
  account_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  submit_effect_id TEXT NOT NULL,
  binding_status TEXT NOT NULL,
  observer_backend TEXT NOT NULL,
  first_submitted_at_ms BIGINT NOT NULL,
  terminal_status_changed_at_ms BIGINT,
  last_observed_source TEXT,
  last_observed_at_ms BIGINT,
  last_report_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (runtime_id, internal_order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_trader_order_binding_runtime_external_submit
ON signal_trader_order_binding (runtime_id, external_submit_order_id)
WHERE external_submit_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_trader_order_binding_runtime_external_operate
ON signal_trader_order_binding (runtime_id, external_operate_order_id)
WHERE external_operate_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signal_trader_order_binding_account_product_updated_at
ON signal_trader_order_binding (account_id, product_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_signal_trader_order_binding_status_updated_at
ON signal_trader_order_binding (binding_status, updated_at);

DROP TRIGGER IF EXISTS auto_update_updated_at_signal_trader_order_binding ON signal_trader_order_binding;
CREATE TRIGGER auto_update_updated_at_signal_trader_order_binding
BEFORE UPDATE ON signal_trader_order_binding
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
