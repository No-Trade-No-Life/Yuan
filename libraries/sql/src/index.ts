import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { MonoTypeOperatorFunction, Observable, Subject, tap } from 'rxjs';
import { createBufferWriter } from './bufferWriter';
import { requestSQL } from './requestSQL';
export * from './requestSQL';

/**
 * 进行值的转义，防止 SQL 注入
 *
 * @public
 */
export const escapeSQL = (val: any, options: {} = {}): string => {
  if (val === undefined || val === null) return 'NULL';
  if (typeof val === 'number') return `${val}`;
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // fallback to JSON
  return escapeSQL(JSON.stringify(val));
};

/**
 * 进行值的转义，防止 SQL 注入
 *
 * @deprecated - Use `escapeSQL` instead
 *
 * @public
 */
export const escape = escapeSQL;

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
     * 是否忽略插入冲突 (默认 false)
     */
    ignoreConflict?: boolean;

    /**
     * 冲突时需要检查的键
     *
     * 如果一批写入中有多个数据，具有相同 key，仅取最后一个
     */
    conflictKeys?: Array<keyof T>;

    /**
     * SQL 语句是否以 `RETURNING *` 结尾
     */
    returningAll?: boolean;
  },
): string => {
  if (data.length === 0) throw 'Data is empty';
  const columns = (options?.columns ?? Object.keys(data[0]).filter(isValidColumnName)) as string[];
  const keyFn = options?.conflictKeys
    ? (x: T) => encodePath(options.conflictKeys!.map((k) => x[k]))
    : undefined;
  const toInsert = keyFn ? [...new Map(data.map((x) => [keyFn(x), x])).values()] : data;
  return `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${toInsert
    .map((x) => `(${columns.map((c) => escapeSQL(x[c as keyof T])).join(',')})`)
    .join(',')} ${
    options?.ignoreConflict
      ? 'ON CONFLICT DO NOTHING'
      : options?.conflictKeys
      ? `ON CONFLICT (${options.conflictKeys.join(',')}) DO UPDATE SET ${columns.map(
          (c) => `${c} = EXCLUDED.${c}`,
        )}`
      : ''
  } ${options?.returningAll ? 'RETURNING *' : ''}`;
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
          ignoreConflict: ctx.ignoreConflict,
          conflictKeys: ctx.conflictKeys,
        }),
      ),
    data$: ctx.data$,
    dispose$: terminal.dispose$,
  });

  terminal.server.provideService('BufferWriterStatus', {}, () => [
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
   * 是否忽略插入冲突 (默认 false)
   */
  ignoreConflict?: boolean;
  /**
   * 冲突时需要检查的键
   *
   * 一批写入中，多个数据具有相同 key 的数据仅取最后一个
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
