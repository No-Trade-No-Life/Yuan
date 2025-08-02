import { AddMigration } from '@yuants/sql';

AddMigration({
  id: 'dcc5ee42-00da-4eca-8abc-6bb165dcdd41',
  name: 'create_table_order',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS "order" (
      order_id TEXT,
      account_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      position_id TEXT,
      order_type TEXT,
      order_direction TEXT,
      volume DECIMAL(20, 8) NOT NULL,
      submit_at BIGINT,
      filled_at BIGINT,
      price DECIMAL(20, 8),
      traded_volume DECIMAL(20, 8),
      traded_price DECIMAL(20, 8),
      order_status TEXT,
      comment TEXT,
      profit_correction DECIMAL(20, 8),
      real_profit DECIMAL(20, 8),
      inferred_base_currency_price DECIMAL(20, 8),
      take_profit_price DECIMAL(20, 8),
      stop_loss_price DECIMAL(20, 8),
    );

    CREATE INDEX IF NOT EXISTS idx_order_account_id ON "order" (account_id);
    CREATE INDEX IF NOT EXISTS idx_order_product_id ON "order" (product_id);
    CREATE INDEX IF NOT EXISTS idx_order_position_id ON "order" (position_id);
    CREATE INDEX IF NOT EXISTS idx_order_order_id ON "order" (order_id);
    CREATE INDEX IF NOT EXISTS idx_order_submit_at ON "order" (submit_at);
    CREATE INDEX IF NOT EXISTS idx_order_filled_at ON "order" (filled_at);
  `,
});
