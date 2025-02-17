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

AddMigration({
  id: '0d6d3c0c-0c6d-4f9f-9c7b-8e0e9b0b8c5d',
  name: 'create-hypertable-for-twitter_messages',
  dependencies: ['73ce7f3e-f359-4968-b57a-8ecf8deb71c7'],
  statement: `
CREATE EXTENSION IF NOT EXISTS timescaledb;
ALTER TABLE twitter_messages DROP CONSTRAINT IF EXISTS twitter_messages_pkey;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'twitter_messages'::regclass
        AND conname = 'twitter_messages_key'
    ) THEN
        ALTER TABLE twitter_messages
        ADD CONSTRAINT twitter_messages_key
        UNIQUE (id, created_at);
    END IF;
END $$;
SELECT create_hypertable('twitter_messages', by_range('created_at'), migrate_data => TRUE, if_not_exists => TRUE);
`,
});

ExecuteMigrations(terminal);
