import { Terminal } from '@yuants/protocol';
import { decodeBase64, decryptByPrivateKeyAsync, encodePath, fromPrivateKey, newError } from '@yuants/utils';
import { ISecret } from './types';
import { verifySecretSigner } from './verifySecretSigner';

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
  const valid = verifySecretSigner(secret);
  if (!valid) throw newError('InvalidSecretSignature', { secret });

  const keyPair = fromPrivateKey(reader_private_key);

  let decrypted: Uint8Array;
  if (secret.reader !== keyPair.public_key) {
    const data_base64 = await terminal.client.requestForResponseData<
      { secret_sign: string; public_key: string },
      string
    >(encodePath('ReadSecret', secret.reader), {
      secret_sign: secret.sign,
      public_key: terminal.keyPair.public_key,
    });
    decrypted = await terminal.security.decryptDataWithRemotePublicKey(
      decodeBase64(data_base64),
      secret.reader,
    );
  } else {
    decrypted = await decryptByPrivateKeyAsync(decodeBase64(secret.data), reader_private_key);
  }
  return decrypted;
};
