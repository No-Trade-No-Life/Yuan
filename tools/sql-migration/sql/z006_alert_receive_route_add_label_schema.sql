ALTER TABLE alert_receive_route
ADD COLUMN IF NOT EXISTS label_schema JSONB;

ALTER TABLE alert_receive_route
DROP COLUMN IF EXISTS label_filters;
