CREATE TABLE IF NOT EXISTS
    transfer_order (
        order_id UUID NOT NULL PRIMARY KEY,
        created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        credit_account_id TEXT NOT NULL,
        debit_account_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        expected_amount NUMERIC NOT NULL,
        status TEXT NOT NULL DEFAULT 'INIT',
        error_message TEXT,
        timeout_at timestamptz,
        routing_path jsonb,
        current_routing_index INTEGER,
        current_tx_account_id TEXT,
        current_rx_account_id TEXT,
        current_tx_address TEXT,
        current_rx_address TEXT,
        current_network_id TEXT,
        current_tx_state TEXT,
        current_transaction_id TEXT,
        current_tx_context TEXT,
        current_rx_state TEXT,
        current_rx_context TEXT,
        current_step_started_at BIGINT,
        current_amount NUMERIC
    );

CREATE INDEX IF NOT EXISTS idx_transfer_order_status ON transfer_order (status);

CREATE TABLE IF NOT EXISTS
    transfer_network_info (
        network_id TEXT NOT NULL PRIMARY KEY,
        commission NUMERIC NOT NULL,
        currency TEXT NOT NULL,
        timeout BIGINT
    );

CREATE TABLE IF NOT EXISTS
    transfer_routing_cache (
        credit_account_id TEXT NOT NULL,
        debit_account_id TEXT NOT NULL,
        routing_path jsonb NOT NULL
    );

CREATE TABLE IF NOT EXISTS
    account_address_info (
        account_id TEXT NOT NULL,
        network_id TEXT NOT NULL,
        address TEXT NOT NULL,
        currency TEXT NOT NULL
    );