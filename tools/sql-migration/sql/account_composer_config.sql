-- account_composer_config table
CREATE TABLE IF NOT EXISTS
    account_composer_config (
        account_id TEXT PRIMARY KEY NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sources JSONB NOT NULL DEFAULT '[]'::JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON account_composer_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();