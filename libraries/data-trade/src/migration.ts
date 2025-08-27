import { AddMigration } from '@yuants/sql';

AddMigration({
  id: 'd44e8238-cb04-4d90-a502-6a46fbc6bc17',
  name: 'create_table_trade',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS trade (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      traded_volume TEXT,
      traded_price TEXT,
      traded_value TEXT,
      fee TEXT,
      fee_currency TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_trade_created_at on trade (created_at desc);
    CREATE INDEX IF NOT EXISTS idx_trade_updated_at on trade (updated_at desc);
    create or replace trigger auto_update_updated_at before update
              on trade for each row execute function update_updated_at_column();
  `,
});
