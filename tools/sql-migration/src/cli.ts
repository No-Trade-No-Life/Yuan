#!/usr/bin/env node
import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { encodeBase58, formatTime, sha256 } from '@yuants/utils';
import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { defer } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

interface IMigration {
  /**
   * The unique identifier for this migration.
   *
   * SHOULD BE GLOBALLY UNIQUE
   *
   * Recommend to hard coded with a UUID
   */
  id: string;
  /**
   * The name of the migration.
   */
  name: string;
  /**
   * The SQL statement to run.
   */
  statement: string;
}

const makeMigrationSQL = (migration: IMigration) => `
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT id FROM migration WHERE id = ${escapeSQL(migration.id)}) THEN
    ${buildInsertManyIntoTableSQL([migration], 'migration')};
    ${migration.statement}
  END IF;
END $migration$;
`;

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS migration (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  statement TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

defer(async () => {
  // Define the structure of a SQL migration
  await requestSQL(terminal, INIT_SQL);

  const sqlDir = process.env.SQL_DIR ? resolve(process.env.SQL_DIR) : join(__dirname, '../sql');
  const sqlFiles = (await readdir(sqlDir)).filter((file) => file.endsWith('.sql'));
  sqlFiles.sort((a, b) => a.localeCompare(b));
  for (const file of sqlFiles) {
    const filePath = join(sqlDir, file);
    const sql = await readFile(filePath, 'utf-8');
    const id = encodeBase58(await sha256(new TextEncoder().encode(sql)));
    console.info(formatTime(Date.now()), 'ApplyingMigration', `id = ${id}, name = ${file}`);
    const migration: IMigration = {
      id,
      name: file,
      statement: sql,
    };
    await requestSQL(terminal, makeMigrationSQL(migration));
    console.log(formatTime(Date.now()), 'MigrationApplied', `id = ${migration.id}, name = ${migration.name}`);
  }
}).subscribe({
  error: (err) => {
    console.error('SQL migration failed:', err);
    process.exit(1);
  },
  complete: () => {
    process.exit(0);
  },
});
