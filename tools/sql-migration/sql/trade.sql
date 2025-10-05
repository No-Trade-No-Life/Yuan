-- trade 表
CREATE TABLE IF NOT EXISTS
    trade (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        traded_volume TEXT,
        traded_price TEXT,
        traded_value TEXT,
        fee TEXT,
        fee_currency TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

ALTER TABLE trade
ADD COLUMN IF NOT EXISTS post_volume TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_trade_created_at ON trade (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_updated_at ON trade (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();


CREATE INDEX IF NOT EXISTS idx_trade_account_id ON trade (account_id);
