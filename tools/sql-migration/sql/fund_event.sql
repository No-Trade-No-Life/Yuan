-- fund_event 表
CREATE TABLE IF NOT EXISTS
    fund_event (
        account_id TEXT NOT NULL PRIMARY KEY,
        events JSONB NOT NULL DEFAULT '[]'
    );

CREATE INDEX IF NOT EXISTS idx_fund_event_account_id ON fund_event (account_id);
