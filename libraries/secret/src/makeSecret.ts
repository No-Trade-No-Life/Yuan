import { IEd25519KeyPair, encodeBase64, encryptByPublicKeyAsync, signMessage } from '@yuants/utils';
import { ISecret } from './types';
import { makeSecretSignerMessage } from './utils';

/**
 * Make a secret record
 * @param secret - The secret data to encrypt
 * @param tags - The tags associated with the secret
 * @param reader - The public key of the reader
 * @param signerKeyPair - The key pair of the signer
 * @returns The secret record
 * @public
 */
export const makeSecret = async (
  secret: Uint8Array,
  tags: Record<string, string>,
  reader: string,
  signerKeyPair: IEd25519KeyPair,
) => {
  const data = encodeBase64(await encryptByPublicKeyAsync(secret, reader));
  const signer = signerKeyPair.public_key;
  const message = makeSecretSignerMessage(signer, reader, tags, data);
  const signature = signMessage(message, signerKeyPair.private_key);

  const record: ISecret = {
    sign: signature,
    signer: signer,
    reader: reader,
    tags: tags,
    data: data,
  };
  return record;
};
