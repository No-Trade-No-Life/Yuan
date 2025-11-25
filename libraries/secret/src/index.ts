import { Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, escapeSQL, requestSQL } from '@yuants/sql';
import {
  decodeBase64,
  decryptByPrivateKeyAsync,
  encodeBase64,
  encodePath,
  encryptByPublicKeyAsync,
  fromPrivateKey,
  newError,
  signMessage,
  verifyMessage,
} from '@yuants/utils';

/**
 * Arbitrary secret data storage interface
 *
 * @public
 */
export interface ISecret {
  /**
   * Signature of the secret record (signer + reader + tags + data) (Primary Key)
   */
  sign: string;
  /**
   * Public key of the signer of the secret record (Indexed)
   */
  signer: string;
  /**
   * Public key of the reader authorized to decrypt the secret data (Indexed)
   */
  reader: string;
  /**
   * JSONB object of tags (GIN indexed)
   */
  tags: Record<string, string>;
  /**
   * Base64 encoded encrypted data
   */
  data: string;
}

const getTagsText = (tags: Record<string, string>) =>
  Object.entries(tags)
    .sort(([k1], [k2]) => k1.localeCompare(k2))
    .map(([k, v]) => `${k}=${v}`)
    .join('');

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
  const data = encodeBase64(await encryptByPublicKeyAsync(secret, reader));
  const tagsText = getTagsText(tags);
  const signer = terminal.keyPair.public_key;
  const message = signer + reader + tagsText + data;
  const signature = signMessage(message, signer_private_key);

  const record: ISecret = {
    sign: signature,
    signer: signer,
    reader: reader,
    tags: tags,
    data: data,
  };

  await requestSQL(
    terminal,
    buildInsertManyIntoTableSQL([record], 'secret', {
      ignoreConflict: true,
    }),
  );

  return record;
};

/**
 * Read and decrypt a secret
 * @param terminal - The terminal instance
 * @param secret - The secret record to read
 * @param reader_private_key - The private key of the reader
 * @returns The decrypted secret data
 *
 * @public
 */
export const readSecret = async (
  terminal: Terminal,
  secret: ISecret,
  reader_private_key: string = terminal.keyPair.private_key,
): Promise<Uint8Array> => {
  const message = secret.signer + secret.reader + getTagsText(secret.tags) + secret.data;

  const valid = verifyMessage(message, secret.sign, secret.signer);
  if (!valid) throw newError('InvalidSecretSignature', { message });

  const keyPair = fromPrivateKey(reader_private_key);

  if (secret.reader !== keyPair.public_key) {
    const data_base64 = await terminal.client.requestForResponseData<
      { secret_sign: string; public_key: string },
      string
    >(encodePath('ReadSecret', secret.reader), {
      secret_sign: secret.sign,
      public_key: terminal.keyPair.public_key,
    });
    return terminal.security.decryptDataWithRemotePublicKey(decodeBase64(data_base64), secret.reader);
  }
  const decrypted = await decryptByPrivateKeyAsync(decodeBase64(secret.data), reader_private_key);
  return decrypted;
};

/**
 * Setup secret proxy service on the terminal
 *
 * @param terminal - The terminal instance
 * @param trusted_public_keys - Set of trusted public keys allowed to read secrets
 * @returns Set of trusted public keys
 *
 * @public
 */
export const setupSecretProxyService = (terminal: Terminal, trusted_public_keys = new Set<string>()) => {
  trusted_public_keys.add(terminal.keyPair.public_key);

  terminal.server.provideService<
    {
      secret_sign: string;
      public_key: string;
    },
    string
  >(
    encodePath('ReadSecret', terminal.keyPair.public_key),
    {
      type: 'object',
      required: ['secret_sign', 'public_key'],
      properties: {
        secret_sign: { type: 'string' },
        public_key: { type: 'string' },
      },
    },
    async ({ req }) => {
      if (!trusted_public_keys.has(req.public_key))
        throw newError('PublicKeyNotTrusted', { public_key: req.public_key });

      const [secret] = await requestSQL<ISecret[]>(
        terminal,
        `select * from secret where sign = ${escapeSQL(req.secret_sign)}`,
      );

      if (!secret) throw newError('SecretNotFound', { secret_sign: req.secret_sign });

      const data = await readSecret(terminal, secret);

      const dataForRemote = await terminal.security.encryptDataWithRemotePublicKey(data, req.public_key);

      const data_base64 = encodeBase64(dataForRemote);

      return { res: { code: 0, message: 'OK', data: data_base64 } };
    },
  );

  return trusted_public_keys;
};
