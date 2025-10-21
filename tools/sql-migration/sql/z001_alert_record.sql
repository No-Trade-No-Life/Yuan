-- 告警记录表
CREATE TABLE IF NOT EXISTS
    alert_record (
        id TEXT PRIMARY KEY,
        alert_name TEXT NOT NULL,
        current_value TEXT,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT,
        env TEXT NOT NULL,
        runbook_url TEXT,
        group_name TEXT NOT NULL,
        finalized BOOLEAN DEFAULT FALSE,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        message_ids JSONB DEFAULT '[]'::JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_alert_record_updated_at ON alert_record (updated_at);
CREATE INDEX IF NOT EXISTS idx_alert_record_status ON alert_record (status);
CREATE INDEX IF NOT EXISTS idx_alert_record_finalized ON alert_record (finalized);
CREATE INDEX IF NOT EXISTS idx_alert_record_group_name ON alert_record (group_name);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON alert_record FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
