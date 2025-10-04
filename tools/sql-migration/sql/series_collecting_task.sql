-- series_collecting_task 表
CREATE TABLE IF NOT EXISTS
    series_collecting_task (
        table_name TEXT NOT NULL,
        series_id TEXT NOT NULL,
        cron_pattern TEXT NOT NULL,
        cron_timezone TEXT NOT NULL,
        disabled BOOLEAN NOT NULL DEFAULT FALSE,
        replay_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (table_name, series_id)
    );

CREATE INDEX IF NOT EXISTS idx_series_collecting_task_updated_at ON series_collecting_task (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON series_collecting_task FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
