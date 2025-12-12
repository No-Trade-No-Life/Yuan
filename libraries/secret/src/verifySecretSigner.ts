import { verifyMessage } from '@yuants/utils';
import { ISecret } from './types';
import { makeSecretSignerMessage } from './utils';

/**
 * Verify the signature of a secret record is signed by the signer
 * @param secret - The secret record to verify
 * @returns
 * @public
 */
export const verifySecretSigner = (secret: ISecret): boolean => {
  const message = makeSecretSignerMessage(secret.signer, secret.reader, secret.tags, secret.data);
  return verifyMessage(message, secret.sign, secret.signer);
};
