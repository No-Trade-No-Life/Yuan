CREATE TABLE IF NOT EXISTS
    interest_rate (
        series_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        long_rate TEXT NOT NULL,
        short_rate TEXT NOT NULL,
        settlement_price TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (series_id, created_at)
    );

CREATE INDEX IF NOT EXISTS idx_interest_rate_series_id_created_at ON interest_rate (series_id, created_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON interest_rate FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();