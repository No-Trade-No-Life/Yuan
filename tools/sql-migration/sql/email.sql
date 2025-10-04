-- email 表
CREATE TABLE IF NOT EXISTS
    email (
        address TEXT NOT NULL,
        uid TEXT NOT NULL,
        attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
        body JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (address, uid)
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON email FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS email_address_idx ON email (address);
