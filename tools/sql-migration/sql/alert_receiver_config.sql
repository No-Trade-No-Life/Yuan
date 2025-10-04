-- alert_receiver_config 表
CREATE TABLE IF NOT EXISTS
    alert_receiver_config (
        TYPE TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        enabled BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (
            TYPE,
            receiver_id
        )
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON alert_receiver_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();