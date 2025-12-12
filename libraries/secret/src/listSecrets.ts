import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { ISecret } from './types';

/**
 * List secrets with filtering options
 * @param terminal - The terminal instance
 * @param filter - Filter options including tags and reader
 * @returns
 * @public
 */
export const listSecrets = async (
  terminal: Terminal,
  filter: { tags?: Record<string, string>; reader?: string },
): Promise<ISecret[]> => {
  const conditions: string[] = [];
  if (filter.reader) {
    conditions.push(`reader = ${escapeSQL(filter.reader)}`);
  }
  if (filter.tags) {
    for (const [k, v] of Object.entries(filter.tags)) {
      conditions.push(`tags->>${escapeSQL(k)} = ${escapeSQL(v)}`);
    }
  }

  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret ${conditions.length ? 'where ' + conditions.join(' and ') : ''}`,
  );
  return secrets;
};
