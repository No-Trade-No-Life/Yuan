-- request_emitter 表
CREATE TABLE IF NOT EXISTS
    request_emitter (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid (),
        "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "interval" INTEGER NOT NULL,
        "method" TEXT NOT NULL,
        request JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_request_emitter_enabled ON request_emitter (enabled);

CREATE INDEX IF NOT EXISTS idx_request_emitter_interval ON request_emitter ("interval");

CREATE INDEX IF NOT EXISTS idx_request_emitter_method ON request_emitter ("method");

CREATE INDEX IF NOT EXISTS idx_request_emitter_created_at ON request_emitter (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_emitter_updated_at ON request_emitter (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON request_emitter FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
