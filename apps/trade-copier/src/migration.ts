import { Terminal } from '@yuants/protocol';
import { AddMigration, ExecuteMigrations } from '@yuants/sql';

AddMigration({
  id: '8ac0f9bf-068b-4076-af81-06be5b60b822',
  name: 'create_table_trade_copy_relation_and_trade_copier_trade_config',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS trade_copy_relation (
  id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  source_account_id TEXT NOT NULL,
  target_account_id TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  multiple FLOAT8 NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  exclusive_comment_pattern TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP

);

create or replace trigger auto_update_updated_at before update on trade_copy_relation for each row execute function update_updated_at_column();

CREATE TABLE IF NOT EXISTS trade_copier_trade_config (
  id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  max_volume_per_order FLOAT8 NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP

);

create or replace trigger auto_update_updated_at before update on trade_copier_trade_config for each row execute function update_updated_at_column();

  `,
});

ExecuteMigrations(Terminal.fromNodeEnv());
