import { sign } from 'tweetnacl';
import bs58 from 'bs58';

/**
 * create a new key pair
 *
 * - ED25519 key pair
 * - base58 encoded
 *
 * @public
 */
export const createKeyPair = (): { public_key: string; private_key: string } => {
  const { publicKey, secretKey } = sign.keyPair();
  return { public_key: bs58.encode(publicKey), private_key: bs58.encode(secretKey) };
};

/**
 * create a key pair from a secret key
 * @param privateKey - the private key to create the key pair from (base58 encoded)
 * @returns the public key and the private key (both base58 encoded)
 * @public
 */
export const fromPrivateKey = (privateKey: string): { public_key: string; private_key: string } => {
  const pair = sign.keyPair.fromSecretKey(bs58.decode(privateKey));
  return { public_key: bs58.encode(pair.publicKey), private_key: privateKey };
};

/**
 * sign a message with a private key
 *
 * @param message - the message to sign
 * @param privateKey - the private key to sign the message with (base58 encoded)
 * @returns the signature (base58 encoded)
 * @public
 */
export const signMessage = (message: string, privateKey: string): string => {
  const secretKeyUint8Array = bs58.decode(privateKey);
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
export const verifyMessage = (message: string, signature: string, publicKey: string): boolean => {
  const publicKeyUint8Array = bs58.decode(publicKey);
  const messageUint8Array = new TextEncoder().encode(message);
  const signatureUint8Array = bs58.decode(signature);
  return sign.detached.verify(messageUint8Array, signatureUint8Array, publicKeyUint8Array);
};
