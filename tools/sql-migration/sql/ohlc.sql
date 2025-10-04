-- ohlc 表
CREATE TABLE IF NOT EXISTS
    ohlc (
        series_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        duration TEXT NOT NULL,
        closed_at TIMESTAMPTZ NOT NULL,
        open TEXT NOT NULL,
        high TEXT NOT NULL,
        low TEXT NOT NULL,
        CLOSE TEXT NOT NULL,
        volume TEXT,
        open_interest TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (series_id, created_at)
    );

CREATE INDEX IF NOT EXISTS idx_ohlc_series_id_created_at ON ohlc (series_id, created_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON ohlc FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
