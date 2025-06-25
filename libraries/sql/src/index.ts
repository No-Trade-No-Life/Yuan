import { formatTime } from '@yuants/data-model';
import { IResponse, Terminal } from '@yuants/protocol';
import {
  concatMap,
  defer,
  from,
  lastValueFrom,
  MonoTypeOperatorFunction,
  Observable,
  retry,
  Subject,
  tap,
} from 'rxjs';
import { createBufferWriter } from './bufferWriter';

declare module '@yuants/protocol' {
  interface IService {
    SQL: {
      req: {
        query: string;
      };
      res: IResponse<any[]>;
      frame: {};
    };
  }
}

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
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT id FROM migrations WHERE id::text = '${migration.id}') THEN
    INSERT INTO migrations (id, name) VALUES ('${migration.id}', '${migration.name}');
    ${migration.statement}
  END IF;
END $migration$;
`;

const allMigrations: ISQLMigration[] = [];

/**
 * Add a migration to the list of migrations to run.
 *
 * @public
 * @param migration - The migration to add
 */
export const AddMigration = (migration: ISQLMigration) => {
  allMigrations.push(migration);
};

/**
 * Execute all migrations in the list.
 *
 * @public
 * @param terminal - The terminal to use for running the migrations
 */
export const ExecuteMigrations = async (terminal: Terminal) => {
  console.info(formatTime(Date.now()), `SetupMigrationStart`);

  await lastValueFrom(
    from(allMigrations).pipe(
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

/**
 * 执行 SQL 语句
 *
 * @public
 */
export const requestSQL = async <T = unknown>(terminal: Terminal, query: string): Promise<T> => {
  const result = await terminal.requestForResponse('SQL', {
    query,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to run SQL query: ${query}, message: ${result.message}`);
  }

  return result.data as any as T;
};

/**
 * 进行值的转义，防止 SQL 注入
 *
 * @public
 */
export const escape = (val: any, options: {} = {}): string => {
  if (val === undefined || val === null) return 'NULL';
  if (typeof val === 'number') return `${val}`;
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // fallback to JSON
  return escape(JSON.stringify(val));
};

const isValidColumnName = (name: string): boolean => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
};

/**
 * 构造 Insert Many 模式的 SQL 查询语句 (INSERT INTO ... VALUES ...)
 *
 * @public
 */
export const buildInsertManyIntoTableSQL = <T extends {}>(
  data: T[],
  tableName: string,
  options?: {
    /**
     * 需要插入的列名
     *
     * 留空则使用数据的第一行的所有列进行推断
     */
    columns?: Array<keyof T>;
    /**
     * 具有相同 key 的数据仅取最后一个
     */
    keyFn?: (data: T) => string;
    /**
     * 是否忽略插入冲突 (默认 false)
     */
    ignoreConflict?: boolean;

    /**
     * 冲突时需要检查的键
     */
    conflictKeys?: Array<keyof T>;
  },
): string => {
  if (data.length === 0) throw 'Data is empty';
  const columns = (options?.columns ?? Object.keys(data[0]).filter(isValidColumnName)) as string[];
  const keyFn = options?.keyFn;
  const toInsert = keyFn ? [...new Map(data.map((x) => [keyFn(x), x])).values()] : data;
  return `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${toInsert
    .map((x) => `(${columns.map((c) => escape(x[c as keyof T])).join(',')})`)
    .join(',')} ${
    options?.ignoreConflict
      ? 'ON CONFLICT DO NOTHING'
      : options?.conflictKeys
      ? `ON CONFLICT (${options.conflictKeys.join(',')}) DO UPDATE SET ${columns.map(
          (c) => `${c} = EXCLUDED.${c}`,
        )}`
      : ''
  }`;
};

/**
 * 创建一个 SQL 缓冲写入器
 *
 * @public
 */
export const createSQLWriter = <T extends {}>(
  terminal: Terminal,
  ctx: {
    /**
     * 数据流
     *
     * 数据流中的每一项都将被写入到数据库中的一行中
     */
    data$: Observable<T>;
  } & ISQLWritterContext<T>,
) => {
  const writer = createBufferWriter<T>({
    writeInterval: ctx.writeInterval,
    bulkWrite: (data) =>
      requestSQL(
        terminal,
        buildInsertManyIntoTableSQL(data, ctx.tableName, {
          columns: ctx.columns,
          keyFn: ctx.keyFn,
          ignoreConflict: ctx.ignoreConflict,
          conflictKeys: ctx.conflictKeys,
        }),
      ),
    data$: ctx.data$,
    dispose$: terminal.dispose$,
  });

  terminal.provideService('BufferWriterStatus', {}, () => [
    { res: { code: 0, message: 'OK', data: writer.state } },
  ]);
};

/**
 * Context for the SQL writer
 * @public
 */
export interface ISQLWritterContext<T extends {}> {
  /**
   * 目标表名
   */
  tableName: string;
  /**
   * 写入间隔 (ms)
   */
  writeInterval: number;
  /**
   * 需要插入的列名
   *
   * 留空则使用数据的第一行的所有列进行推断
   */
  columns?: Array<keyof T>;
  /**
   * 具有相同 key 的数据仅取最后一个
   */
  keyFn?: (data: T) => string;
  /**
   * 是否忽略插入冲突 (默认 false)
   */
  ignoreConflict?: boolean;
  /**
   * 冲突时需要检查的键
   */
  conflictKeys?: Array<keyof T>;
}

/**
 * Pipe operator to write data to a SQL table
 * @public
 */
export const writeToSQL =
  <T extends {}>(ctx: ISQLWritterContext<T> & { terminal: Terminal }): MonoTypeOperatorFunction<T> =>
  (source$) => {
    const data$ = new Subject<T>();
    createSQLWriter(ctx.terminal, {
      ...ctx,
      data$: data$,
    });
    return source$.pipe(
      tap((x) => {
        data$.next(x);
      }),
    );
  };
