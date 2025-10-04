-- transfer_routing_cache 表
CREATE TABLE IF NOT EXISTS
    transfer_routing_cache (
        credit_account_id TEXT NOT NULL,
        debit_account_id TEXT NOT NULL,
        routing_path jsonb NOT NULL
    );
