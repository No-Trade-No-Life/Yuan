import { AddMigration, ExecuteMigrations } from '@yuants/sql';
import { terminal } from './terminal';

AddMigration({
  id: 'f07b00ea-5301-4cff-b3e4-48e807683c75',
  name: 'create-table_transfer_order',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS transfer_order (
  order_id uuid NOT NULL PRIMARY KEY,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
  credit_account_id text NOT NULL,
  debit_account_id text NOT NULL,
  currency text NOT NULL,
  expected_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'INIT',
  error_message text,
  timeout_at timestamptz,
  routing_path jsonb,
  current_routing_index integer not null,
  current_tx_account_id text,
  current_rx_account_id text,
  current_tx_address text,
  current_rx_address text,
  current_network_id text,
  current_tx_state text,
  current_transaction_id text,
  current_tx_context text,
  current_rx_state text,
  current_rx_context text,
  current_step_started_at bigint,
  current_amount numeric
);

CREATE INDEX IF NOT EXISTS idx_transfer_order_status ON transfer_order (status);`,
});

AddMigration({
  id: '18885504-4011-4f29-baf7-f6cb24dbdf10',
  name: 'create-table-transfer_network_info',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS transfer_network_info (
  network_id text NOT NULL PRIMARY KEY,
  commission numeric NOT NULL,
  currency text NOT NULL,
  timeout bigint
);
`,
});

AddMigration({
  id: '11ddc01c-cf0a-4b25-bbad-94102f942a14',
  name: 'create-table-transfer_routing_cache',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS transfer_routing_cache (
  credit_account_id text NOT NULL,
  debit_account_id text NOT NULL,
  routing_path jsonb NOT NULL
);
`,
});

AddMigration({
  id: '8009c194-de14-4c4e-b467-48cf88600a2d',
  name: 'create-table-account_address_info',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS account_address_info (
  account_id text NOT NULL,
  network_id text NOT NULL,
  address text NOT NULL,
  currency text NOT NULL
);
`,
});

ExecuteMigrations(terminal);
