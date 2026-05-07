CREATE TABLE IF NOT EXISTS signal_trader_runtime_checkpoint (
  runtime_id TEXT PRIMARY KEY NOT NULL,
  last_event_offset BIGINT NOT NULL,
  last_event_id TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  health_status TEXT NOT NULL,
  lock_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE signal_trader_runtime_checkpoint
ADD COLUMN IF NOT EXISTS last_account_snapshot_at_ms BIGINT;

ALTER TABLE signal_trader_runtime_checkpoint
ADD COLUMN IF NOT EXISTS last_account_snapshot_status TEXT;

ALTER TABLE signal_trader_runtime_checkpoint
ADD COLUMN IF NOT EXISTS last_matched_reconciliation_at_ms BIGINT;

ALTER TABLE signal_trader_runtime_checkpoint
ADD COLUMN IF NOT EXISTS last_matched_reconciliation_snapshot_id TEXT;

CREATE INDEX IF NOT EXISTS idx_signal_trader_runtime_checkpoint_updated_at
ON signal_trader_runtime_checkpoint (updated_at);

DROP TRIGGER IF EXISTS auto_update_updated_at_signal_trader_runtime_checkpoint ON signal_trader_runtime_checkpoint;
CREATE TRIGGER auto_update_updated_at_signal_trader_runtime_checkpoint
BEFORE UPDATE ON signal_trader_runtime_checkpoint
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
