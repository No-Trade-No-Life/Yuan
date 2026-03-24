CREATE TABLE IF NOT EXISTS signal_trader_event (
  runtime_id TEXT NOT NULL,
  event_offset BIGSERIAL NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INT NOT NULL,
  reducer_version INT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_fingerprint TEXT,
  event_created_at_ms BIGINT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (runtime_id, event_offset),
  UNIQUE (runtime_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_signal_trader_event_runtime_idempotency_key ON signal_trader_event (runtime_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_signal_trader_event_runtime_type_created_at ON signal_trader_event (runtime_id, event_type, event_created_at_ms);
