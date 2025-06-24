import { Terminal } from '@yuants/protocol';
import { AddMigration, ExecuteMigrations } from '@yuants/sql';

AddMigration({
  id: '35bd0733-1827-44cc-a927-286841f2df70',
  name: 'create_table_email',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS email (
    address TEXT NOT NULL,
    uid TEXT NOT NULL,
    attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
    body JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (address, uid)
);
create or replace trigger auto_update_updated_at before update on email for each row execute function update_updated_at_column();
CREATE INDEX IF NOT EXISTS email_address_idx ON email (address);

  `,
});

ExecuteMigrations(Terminal.fromNodeEnv());
