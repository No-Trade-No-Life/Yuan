import { Terminal } from '@yuants/protocol';
import { AddMigration, ExecuteMigrations } from '@yuants/sql';

AddMigration({
  id: '70ab1c8b-c957-456c-b653-d8bace4d367f',
  name: 'create_table_account_composition_relation',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS account_composition_relation (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    source_account_id TEXT NOT NULL,
    target_account_id TEXT NOT NULL,
    multiple FLOAT8 NOT NULL,
    hide_positions BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
create or replace trigger auto_update_updated_at before update on account_composition_relation for each row execute function update_updated_at_column();
`,
});

AddMigration({
  id: 'a7a02751-60cc-4fcd-9927-1de6013597b1',
  name: 'create_table_account_composer_config',
  dependencies: [],
  statement: `
    CREATE TABLE IF NOT EXISTS account_composer_config (
        account_id TEXT PRIMARY KEY NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sources JSONB NOT NULL DEFAULT '[]'::JSONB,

        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    create or replace trigger auto_update_updated_at before update on account_composer_config for each row execute function update_updated_at_column();
  `,
});

ExecuteMigrations(Terminal.fromNodeEnv());
