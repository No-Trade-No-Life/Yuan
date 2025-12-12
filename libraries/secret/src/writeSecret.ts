import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { fromPrivateKey } from '@yuants/utils';
import { ISecret } from './types';
import { makeSecret } from './makeSecret';

/**
 * Write a secret to the database
 * @param terminal - The terminal instance
 * @param tags - The tags associated with the secret
 * @param secret - The secret data
 * @param reader - The public key of the reader
 *
 * @public
 */
export const writeSecret = async (
  terminal: Terminal,
  reader: string,
  tags: Record<string, string>,
  secret: Uint8Array,
  signer_private_key: string = terminal.keyPair.private_key,
): Promise<ISecret> => {
  const record = await makeSecret(secret, tags, reader, fromPrivateKey(signer_private_key));

  await requestSQL(
    terminal,
    buildInsertManyIntoTableSQL([record], 'secret', {
      ignoreConflict: true,
    }),
  );

  return record;
};
