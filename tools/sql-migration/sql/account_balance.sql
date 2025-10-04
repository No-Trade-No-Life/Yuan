-- account_balance 表
CREATE TABLE IF NOT EXISTS
    public.account_balance (
        account_id TEXT NOT NULL PRIMARY KEY,
        currency TEXT,
        equity TEXT,
        balance TEXT,
        profit TEXT,
        free TEXT,
        used TEXT,
        leverage TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_account_balance_created_at ON account_balance (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_balance_updated_at ON account_balance (updated_at DESC);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON account_balance FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
