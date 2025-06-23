import { AddMigration, ExecuteMigrations } from '@yuants/sql';
import { terminal } from './terminal';

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

ExecuteMigrations(terminal);
