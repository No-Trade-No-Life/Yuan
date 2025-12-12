import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { encodeBase64, encodePath, newError } from '@yuants/utils';
import { readSecret } from './readSecret';
import { ISecret } from './types';

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
