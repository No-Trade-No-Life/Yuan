import { Terminal } from '@yuants/protocol';

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
    throw new Error(`Failed to run SQL query: ${query}, message: ${result.message}`);
  }

  return result.data as any as T;
};
