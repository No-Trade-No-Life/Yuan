import { AddMigration } from '@yuants/sql';

AddMigration({
  id: '50cc0c70-6e62-4ea9-a1db-2a83f40e7a28',
  name: 'create_table_data_account',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS public.account (
      account_id TEXT NOT NULL PRIMARY KEY
    );
  `,
});

AddMigration({
  id: '433502e0-5e2c-42c7-91eb-3fafb3979ed3',
  name: 'create_table_data_account_balance',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS public.account_balance (
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
    CREATE INDEX IF NOT EXISTS idx_account_balance_created_at on account_balance (created_at desc);
    CREATE INDEX IF NOT EXISTS idx_account_balance_updated_at on account_balance (updated_at desc);
    create or replace trigger auto_update_updated_at before update
              on account_balance for each row execute function update_updated_at_column();
  `,
});

AddMigration({
  id: '33707e67-7799-4778-aac8-06f0da17ee7b',
  name: 'create_table_data_account_market',
  dependencies: [],
  statement: `
        CREATE TABLE IF NOT EXISTS public.account_market (
        account_id TEXT,
        market_id TEXT,
        PRIMARY KEY (account_id, market_id)
        );
    `,
});

AddMigration({
  id: '0e9eea4b-2107-4e9d-86e5-8b11c74f85d7',
  name: 'create_table_data_position',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS public.position (
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

CREATE INDEX IF NOT EXISTS idx_position_id on position (position_id); 
CREATE INDEX IF NOT EXISTS idx_account_id on position (account_id);    
CREATE INDEX IF NOT EXISTS idx_product_id on position (product_id);
CREATE INDEX IF NOT EXISTS idx_created_at on position (created_at desc);
CREATE INDEX IF NOT EXISTS idx_updated_at on position (updated_at desc);
    `,
});

AddMigration({
  id: '57c1511f-4513-4765-bd09-f327b926415a',
  name: 'alert_table_data_position_add_trigger',
  dependencies: ['0e9eea4b-2107-4e9d-86e5-8b11c74f85d7'],
  statement: `
        ALTER TABLE position DROP CONSTRAINT IF EXISTS position_account_key;
        ALTER TABLE position ADD CONSTRAINT position_account_key PRIMARY KEY (position_id, account_id);

        create or replace trigger auto_update_updated_at before update
              on position for each row execute function update_updated_at_column();
      `,
});
