CREATE TABLE IF NOT EXISTS
    public.account (account_id TEXT NOT NULL PRIMARY KEY);

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

CREATE TABLE IF NOT EXISTS
    public.account_market (
        account_id TEXT,
        market_id TEXT,
        PRIMARY KEY (account_id, market_id)
    );

CREATE TABLE IF NOT EXISTS
    public.position (
        position_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        volume DOUBLE PRECISION NOT NULL,
        position_price DOUBLE PRECISION NOT NULL,
        closable_price DOUBLE PRECISION NOT NULL,
        floating_profit DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_position_id ON public.position (position_id);

CREATE INDEX IF NOT EXISTS idx_account_id ON public.position (account_id);

CREATE INDEX IF NOT EXISTS idx_product_id ON public.position (product_id);

CREATE INDEX IF NOT EXISTS idx_created_at ON public.position (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_updated_at ON public.position (updated_at DESC);

ALTER TABLE public.position
DROP CONSTRAINT IF EXISTS position_account_key;

ALTER TABLE public.position
ADD CONSTRAINT position_account_key PRIMARY KEY (position_id, account_id);

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON public.position FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();