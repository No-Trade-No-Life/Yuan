-- trade_copier_config 表
CREATE TABLE IF NOT EXISTS
    trade_copier_config (
        account_id TEXT PRIMARY KEY NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        strategy JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade_copier_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();