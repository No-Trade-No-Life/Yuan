-- secret 表
CREATE TABLE IF NOT EXISTS
    secret (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        public_data JSONB NOT NULL,
        encrypted_data_base58 TEXT NOT NULL,
        encryption_key_sha256_base58 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON secret FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS secret_encryption_key_sha256_base58_idx ON secret (encryption_key_sha256_base58);

CREATE INDEX IF NOT EXISTS secret_updated_at ON secret (updated_at DESC);

CREATE INDEX IF NOT EXISTS secret_public_data ON secret USING gin (public_data);
