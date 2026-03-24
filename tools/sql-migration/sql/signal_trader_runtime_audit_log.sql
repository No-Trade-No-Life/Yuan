CREATE TABLE IF NOT EXISTS signal_trader_runtime_audit_log (
  seq BIGSERIAL PRIMARY KEY,
  runtime_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operator TEXT,
  note TEXT,
  evidence TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signal_trader_runtime_audit_log_runtime_created_at
ON signal_trader_runtime_audit_log (runtime_id, created_at DESC);
