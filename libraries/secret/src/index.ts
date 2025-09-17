import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import { decodeBase58, decrypt, encodeBase58, encrypt, sha256 } from '@yuants/utils';
/**
 * Arbitrary secret data storage interface
 *
 * @public
 */
export interface ISecret {
  /**
   * Unique identifier for the secret
   */
  id: string;

  /**
   * Public data associated with the secret, stored as JSON
   */
  public_data: any;

  /**
   * Encrypted data in base58 format
   */
  encrypted_data_base58: string;

  /**
   * SHA-256 hash of the encryption key in base58 format
   */
  encryption_key_sha256_base58: string;

  /**
   * Timestamp when the secret was created
   */
  created_at: string;

  /**
   * Timestamp when the secret was last updated (Automatically updated on modification)
   */
  updated_at: string;
}

/**
 * Saves a secret with public data and encrypted data.
 *
 * @public
 */
export const saveSecret = async <T>(ctx: {
  terminal: Terminal;
  public_data: any;
  decrypted_data: T;
  encryption_key_base58: string;
  serialize?: (data: T) => Uint8Array;
  id?: string;
}) => {
  const encryption_key_sha256 = await sha256(decodeBase58(ctx.encryption_key_base58));
  const encryption_key_sha256_base58 = encodeBase58(encryption_key_sha256);

  // Use the provided serialize function or default to JSON.stringify
  const serialize = ctx.serialize || ((data: T) => new TextEncoder().encode(JSON.stringify(data)));

  const encrypted_data = await encrypt(serialize(ctx.decrypted_data), ctx.encryption_key_base58);
  const encrypted_data_base58 = encodeBase58(encrypted_data);

  const secret: Partial<ISecret> = {
    public_data: ctx.public_data,
    encrypted_data_base58,
    encryption_key_sha256_base58,
  };

  if (ctx.id) {
    secret.id = ctx.id;
  }

  return requestSQL<ISecret[]>(
    ctx.terminal,
    buildInsertManyIntoTableSQL([secret], 'secret', { conflictKeys: ['id'], returningAll: true }),
  );
};

/**
 *  Loads secrets based on the provided encryption key and optional updated_after timestamp.
 *
 * @public
 */
export const loadSecrets = async <T>(ctx: {
  terminal: Terminal;
  encryption_key_base58: string;
  updated_after?: string;
  id?: string;
  deserialize?: (data: Uint8Array) => T;
}): Promise<Array<{ secret: ISecret; decrypted_data: T | null; err: any }>> => {
  const encryption_key_sha256 = await sha256(decodeBase58(ctx.encryption_key_base58));
  const encryption_key_sha256_base58 = encodeBase58(encryption_key_sha256);
  // Use the provided deserialize function or default to JSON.parse
  const deserialize = ctx.deserialize || ((data: Uint8Array) => JSON.parse(new TextDecoder().decode(data)));

  const sql =
    `SELECT * FROM secret WHERE encryption_key_sha256_base58 = ${escapeSQL(encryption_key_sha256_base58)}` +
    (ctx.updated_after ? ` AND updated_at > ${escapeSQL(ctx.updated_after)}` : '') +
    (ctx.id ? ` AND id = ${escapeSQL(ctx.id)}` : '');
  console.debug('loadSecrets SQL:', sql);
  const secrets = await requestSQL<ISecret[]>(ctx.terminal, sql);

  return Promise.all(
    secrets.map(async (secret) => {
      try {
        const encrypted_data = decodeBase58(secret.encrypted_data_base58);
        const decrypted_data = deserialize(await decrypt(encrypted_data, ctx.encryption_key_base58));
        return {
          secret,
          decrypted_data,
          err: null,
        };
      } catch (err) {
        return {
          secret,
          decrypted_data: null,
          err,
        };
      }
    }),
  );
};
