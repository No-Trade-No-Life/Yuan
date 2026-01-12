-- account_interest_ledger 表
CREATE TABLE IF NOT EXISTS
    account_interest_ledger (
        id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        primary key (id, account_id)
    );

CREATE INDEX IF NOT EXISTS idx_account_interest_ledger_id ON account_interest_ledger (id);

CREATE INDEX IF NOT EXISTS idx_account_interest_ledger_account_id ON account_interest_ledger (account_id);

CREATE INDEX IF NOT EXISTS idx_account_interest_ledger_product_id ON account_interest_ledger (product_id);

CREATE INDEX IF NOT EXISTS idx_account_interest_ledger_created_at ON account_interest_ledger (created_at desc);

CREATE INDEX IF NOT EXISTS idx_account_interest_ledger_updated_at ON account_interest_ledger (updated_at desc);

CREATE OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON account_interest_ledger FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();