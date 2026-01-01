-- quote 表
CREATE TABLE IF NOT EXISTS
    QUOTE (
        datasource_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_price TEXT,
        ask_price TEXT,
        ask_volume TEXT,
        bid_price TEXT,
        bid_volume TEXT,
        open_interest TEXT,
        interest_rate_long TEXT,
        interest_rate_short TEXT,
        interest_rate_settlement_interval TEXT,
        interest_rate_prev_settled_at TIMESTAMPTZ,
        interest_rate_next_settled_at TIMESTAMPTZ,
        PRIMARY KEY (datasource_id, product_id)
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON QUOTE FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS idx_quote_updated_at ON QUOTE (updated_at DESC);
