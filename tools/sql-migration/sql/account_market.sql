-- account_market 表
CREATE TABLE IF NOT EXISTS
    public.account_market (
        account_id TEXT,
        market_id TEXT,
        PRIMARY KEY (account_id, market_id)
    );
