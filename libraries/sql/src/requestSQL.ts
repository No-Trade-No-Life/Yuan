import { Terminal } from '@yuants/protocol';
import { newError } from '@yuants/utils';

/**
 * 执行 SQL 语句
 *
 * @public
 */
export const requestSQL = async <T = unknown>(terminal: Terminal, query: string): Promise<T> => {
  const result = await terminal.client.requestForResponse<{ query: string }, any[]>('SQL', {
    query,
  });

  if (result.code !== 0) {
    throw newError('FailedToRunSQLQuery', { query, message: result.message });
  }

  return result.data as any as T;
};
