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
  id: '8451f9eb-31c1-49a5-bc57-83958ff3b52e',
  name: 'alert_table_data_product_add_market_id',
  dependencies: [],
  statement: `
        ALTER TABLE public.product
        ADD COLUMN market_id TEXT;
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

CREATE INDEX IF NOT EXISTS idx_account_id on position (account_id);    
CREATE INDEX IF NOT EXISTS idx_product_id on position (product_id);
CREATE INDEX IF NOT EXISTS idx_created_at on position (created_at desc);
CREATE INDEX IF NOT EXISTS idx_updated_at on position (updated_at desc);
    `,
});
