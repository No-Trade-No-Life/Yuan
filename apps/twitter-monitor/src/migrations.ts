import { SetupMigration } from '@yuants/sql';
import { terminal } from './terminal';

SetupMigration(terminal, [
  {
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
  },
]);
