-- account_address_info 表
CREATE TABLE IF NOT EXISTS
    account_address_info (
        account_id TEXT NOT NULL,
        network_id TEXT NOT NULL,
        address TEXT NOT NULL,
        currency TEXT NOT NULL
    );
