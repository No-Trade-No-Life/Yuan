ALTER TABLE alert_record
ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_alert_record_labels ON alert_record USING GIN (labels);
