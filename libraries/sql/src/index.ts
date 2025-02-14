import { formatTime } from '@yuants/data-model';
import { Terminal } from '@yuants/protocol';
import { concatMap, defer, from, lastValueFrom, retry, tap } from 'rxjs';

/**
 * @public
 */
export interface ISQLMigration {
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
  /**
   * Dependencies are the IDs of other migrations that must be run before this one.
   */
  dependencies: string[];
}

const createMigrationsTableSQL = `
CREATE TABLE IF NOT EXISTS migrations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const makeMigrationSQL = (migration: ISQLMigration) => `
DO $$
BEGIN
  IF NOT EXISTS (SELECT id FROM migrations WHERE id::text = '${migration.id}') THEN
    INSERT INTO migrations (id, name) VALUES ('${migration.id}', '${migration.name}');
    ${migration.statement}
  END IF;
END $$;
`;

/**
 * @public
 * @param migrations - The list of migrations to run.
 */
export const SetupMigration = async (terminal: Terminal, migrations: ISQLMigration[]) => {
  console.info(formatTime(Date.now()), `SetupMigrationStart`);

  await lastValueFrom(
    from(migrations).pipe(
      //
      concatMap((migration) =>
        defer(async () => {
          console.info(formatTime(Date.now()), `MigrationStart ${migration.id} ${migration.name}`);
          const ensureMigrationsTableResult = await terminal.requestForResponse('SQL', {
            query: createMigrationsTableSQL,
          });
          if (ensureMigrationsTableResult.code !== 0) {
            console.error(formatTime(Date.now()), JSON.stringify(ensureMigrationsTableResult));
            throw new Error("Failed to ensure 'migrations' table exists");
          }

          if (migration.dependencies.length !== 0) {
            console.info(formatTime(Date.now()), `MigrationDepsCheckStart ${migration.id} ${migration.name}`);
            const checkDepsSQL = `SELECT id FROM migrations WHERE id IN (${migration.dependencies
              .map((id) => `'${id}'`)
              .join(', ')});`;

            const checkDepsResult = await terminal.requestForResponse('SQL', {
              query: checkDepsSQL,
            });

            if (checkDepsResult.code !== 0) {
              console.error(formatTime(Date.now()), JSON.stringify(checkDepsResult));
              throw new Error(`Failed to check dependencies for migration ${migration.id}`);
            }

            const executedDeps = new Set((checkDepsResult.data as any[]).map((row: any) => row.id));

            if (migration.dependencies.some((id) => !executedDeps.has(id))) {
              // Some dependencies are not met
              throw new Error(`Dependencies not met for migration ${migration.id}`);
            }
            console.info(formatTime(Date.now()), `MigrationDepsCheckPass ${migration.id} ${migration.name}`);
          }
          console.info(formatTime(Date.now()), `NoDepsForMigration ${migration.id} ${migration.name}`);

          const migrationStatement = makeMigrationSQL(migration);

          const migrationResult = await terminal.requestForResponse('SQL', {
            query: migrationStatement,
          });

          if (migrationResult.code !== 0) {
            console.error(formatTime(Date.now()), JSON.stringify(migrationResult));
            throw new Error(`Failed to run migration ${migration.id}`);
          }

          return migrationResult;
        }).pipe(
          //
          tap({
            error: (e) => {
              console.error(
                formatTime(Date.now()),
                `MigrationFailed ${migration.id} ${migration.name}`,
                migration.statement,
                e,
              );
            },
            next: (result) => {
              console.info(formatTime(Date.now()), `MigrationSuccess ${migration.id} ${migration.name}`);
            },
          }),
          retry({ delay: 10000 }),
        ),
      ),
    ),
  );

  console.info(formatTime(Date.now()), `SetupMigrationEnd`);
};
