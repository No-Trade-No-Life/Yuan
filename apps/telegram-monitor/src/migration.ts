import { Terminal } from '@yuants/protocol';
import { AddMigration, ExecuteMigrations } from '@yuants/sql';

AddMigration({
  id: 'eb62f3a4-11fd-4386-a86d-1841c3beee13',
  name: 'create-table-telegram_messages',
  dependencies: [],
  statement: `
CREATE TABLE IF NOT EXISTS public.telegram_messages (
	id serial4 NOT NULL,
	message text NOT NULL,
	message_id text NOT NULL,
	chat_id text NOT NULL,
	sender_id text NOT NULL,
	created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
	frozen_at timestamptz NULL,
	raw_data jsonb NOT NULL,
	CONSTRAINT telegram_messages_message_id_key UNIQUE (message_id),
	CONSTRAINT telegram_messages_pkey PRIMARY KEY (id)
);
`,
});

AddMigration({
  id: '15b955fc-96bd-4c3f-8dd9-589456ae3bcc',
  name: 'create-table-telegram_monitor_accounts',
  dependencies: [],
  statement: `
	CREATE TABLE IF NOT EXISTS public.telegram_monitor_accounts (
		id serial4 NOT NULL,
		phone_number text NOT NULL,
		string_session text NOT NULL,
		account_id text NOT NULL,
		created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
		updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
		frozen_at timestamptz NULL
	);
	`,
});

AddMigration({
  id: '9f5e4d03-2e50-4977-9168-2d1b616f8b04',
  name: 'create-hypertable-for-telegram_messages',
  dependencies: ['eb62f3a4-11fd-4386-a86d-1841c3beee13'],
  statement: `
CREATE EXTENSION IF NOT EXISTS timescaledb;
ALTER TABLE telegram_messages DROP CONSTRAINT IF EXISTS telegram_messages_pkey;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'telegram_messages'::regclass
        AND conname = 'telegram_messages_key'
    ) THEN
        ALTER TABLE telegram_messages
        ADD CONSTRAINT telegram_messages_key
        UNIQUE (id, created_at);
    END IF;
END $$;
ALTER TABLE telegram_messages DROP CONSTRAINT IF EXISTS telegram_messages_message_id_key;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'telegram_messages'::regclass
        AND conname = 'telegram_messages_message_id_created_at_key'
    ) THEN
        ALTER TABLE telegram_messages
        ADD CONSTRAINT telegram_messages_message_id_created_at_key
        UNIQUE (message_id, created_at);
    END IF;
END $$;
PERFORM create_hypertable('telegram_messages', by_range('created_at'), migrate_data => TRUE, if_not_exists => TRUE);
`,
});

ExecuteMigrations(Terminal.fromNodeEnv());
