import { sign } from 'tweetnacl';
import bs58 from 'bs58';

/**
 * create a new key pair
 *
 * - ED25519 key pair
 * - base58 encoded
 * @public
 */
export const createKeyPair = () => {
  const { publicKey, secretKey } = sign.keyPair();
  return { publicKey: bs58.encode(publicKey), secretKey: bs58.encode(secretKey) };
};

/**
 * sign a message with a secret key
 *
 * @param message - the message to sign
 * @param secretKey - the secret key to sign the message with (base58 encoded)
 * @returns the signature (base58 encoded)
 * @public
 */
export const signMessage = (message: string, secretKey: string) => {
  const secretKeyUint8Array = bs58.decode(secretKey);
  const messageUint8Array = new TextEncoder().encode(message);
  const signedMessage = sign.detached(messageUint8Array, secretKeyUint8Array);
  return bs58.encode(signedMessage);
};

/**
 * verify a message with a public key
 * @param message - the message to verify
 * @param signature - the signature to verify (base58 encoded)
 * @param publicKey - the public key to verify the message with (base58 encoded)
 * @returns true if the signature is valid, false otherwise, maybe throw an error if public key is invalid
 * @public
 */
export const verifyMessage = (message: string, signature: string, publicKey: string) => {
  const publicKeyUint8Array = bs58.decode(publicKey);
  const messageUint8Array = new TextEncoder().encode(message);
  const signatureUint8Array = bs58.decode(signature);
  return sign.detached.verify(messageUint8Array, signatureUint8Array, publicKeyUint8Array);
};
