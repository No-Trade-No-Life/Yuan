-- ohlc_v2 表（去除 datasource_id/product_id/duration 三列；这些信息已被 series_id 编码覆盖）
CREATE TABLE IF NOT EXISTS
    ohlc_v2 (
        series_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

CREATE INDEX IF NOT EXISTS idx_ohlc_v2_series_id_created_at ON ohlc_v2 (series_id, created_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON ohlc_v2 FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

