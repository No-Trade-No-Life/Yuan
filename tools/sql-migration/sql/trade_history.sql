-- trade_history 表
CREATE TABLE IF NOT EXISTS
    trade_history (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        size TEXT,
        price TEXT,
        fee TEXT,
        fee_currency TEXT,
        pnl TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        primary key (id, account_id)
    );

CREATE INDEX IF NOT EXISTS idx_trade_history_created_at ON trade_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trade_history_updated_at ON trade_history (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON trade_history FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS idx_trade_history_account_id ON trade_history (account_id);

CREATE INDEX IF NOT EXISTS idx_trade_history_product_id ON trade_history (product_id);


CREATE INDEX IF NOT EXISTS idx_trade_history_id ON trade_history (id);


