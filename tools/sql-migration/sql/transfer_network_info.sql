-- transfer_network_info 表
CREATE TABLE IF NOT EXISTS
    transfer_network_info (
        network_id TEXT NOT NULL PRIMARY KEY,
        commission NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        timeout BIGINT
    );
