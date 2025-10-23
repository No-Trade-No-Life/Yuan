-- alert_receive_route 表，用于定义群聊告警路由
CREATE TABLE IF NOT EXISTS
    alert_receive_route (
        chat_id TEXT PRIMARY KEY,
        urgent_on_severity TEXT NOT NULL,
        urgent_user_list JSONB NOT NULL DEFAULT '[]'::JSONB,
        urgent_type TEXT NOT NULL DEFAULT 'app',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_alert_receive_route_enabled ON alert_receive_route (enabled);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON alert_receive_route FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
