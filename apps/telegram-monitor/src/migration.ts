import { SetupMigration } from '@yuants/sql';
import { terminal } from './terminal';

SetupMigration(terminal, [
  {
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
  },
]);

SetupMigration(terminal, [
  {
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
		frozen_at timestamptz NULL,
	);
	`,
  },
]);
