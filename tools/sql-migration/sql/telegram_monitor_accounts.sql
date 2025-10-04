-- telegram_monitor_accounts 表
CREATE TABLE IF NOT EXISTS
    public.telegram_monitor_accounts (
        id serial4 NOT NULL,
        phone_number TEXT NOT NULL,
        string_session TEXT NOT NULL,
        account_id TEXT NOT NULL,
        created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        frozen_at timestamptz NULL
    );
