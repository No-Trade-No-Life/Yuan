import { AddMigration, ExecuteMigrations } from '@yuants/sql';
import { terminal } from './terminal';

AddMigration({
  id: '73ce7f3e-f359-4968-b57a-8ecf8deb71c7',
  name: 'create-table-twitter_messages',
  dependencies: [],
  statement: `
        CREATE TABLE IF NOT EXISTS twitter_messages (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            author TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_description TEXT NOT NULL,
            author_image TEXT NOT NULL,
            author_followers INT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            frozen_at TIMESTAMPTZ,
            raw_data JSONB
        );
    `,
});

AddMigration({
  id: '0a2023d4-c817-4af1-a2b8-00686cb2bdfe',
  name: 'create-table-twitter_monitor_users',
  dependencies: [],
  statement: `
          CREATE TABLE IF NOT EXISTS twitter_monitor_users (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              frozen_at TIMESTAMPTZ
          );
      `,
});

AddMigration({
  id: 'd29f2aed-f9f3-44f0-bec3-bca7beb7782d',
  name: 'update-table-twitter_monitor_users-primary-key',
  dependencies: [],
  statement: `
        ALTER TABLE twitter_monitor_users DROP CONSTRAINT IF EXISTS twitter_monitor_users_pkey;
        ALTER TABLE twitter_monitor_users DROP COLUMN id;
        ALTER TABLE twitter_monitor_users ADD CONSTRAINT twitter_monitor_users_pk PRIMARY KEY (user_id);
        `,
});

ExecuteMigrations(terminal);
