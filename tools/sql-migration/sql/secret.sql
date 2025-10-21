-- secret 表
CREATE TABLE IF NOT EXISTS
    secret (
        "sign" TEXT PRIMARY KEY NOT NULL,
        signer TEXT NOT NULL,
        reader TEXT NOT NULL,
        tags JSONB NOT NULL,
        "data" TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS secret_signer_idx ON secret (signer);

CREATE INDEX IF NOT EXISTS secret_reader_idx ON secret (reader);

CREATE INDEX IF NOT EXISTS secret_tags_idx ON secret USING gin (tags);

CREATE INDEX IF NOT EXISTS secret_created_at_idx ON secret (created_at DESC);