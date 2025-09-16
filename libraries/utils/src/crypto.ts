import bs58 from 'bs58';
import { convertPublicKey, convertSecretKey } from 'ed2curve';
import { box, sign } from 'tweetnacl';
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
 * the ED25519 key pair
 * @public
 */
export interface IEd25519KeyPair {
  public_key: string;
  private_key: string;
}

/**
 * create a key pair from a seed
 * @param seed - the seed to create the key pair from (32 bytes)
 * @returns the public key and the private key (both base58 encoded)
 * @public
 */
export const fromSeed = (seed: Uint8Array): IEd25519KeyPair => {
  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes');
  }
  const pair = sign.keyPair.fromSeed(seed);
  const public_key = bs58.encode(pair.publicKey);
  const private_key = bs58.encode(pair.secretKey);
  return { public_key, private_key };
};

/**
 * create a key pair from a secret key
 * @param privateKey - the private key to create the key pair from (base58 encoded)
 * @returns the public key and the private key (both base58 encoded)
 * @public
 */
export const fromPrivateKey = (privateKey: string): IEd25519KeyPair => {
  const buffer = bs58.decode(privateKey);
  if (buffer.length !== 64) {
    throw new Error('Invalid private key: wrong size');
  }
  const seed = buffer.slice(0, 32);
  const pair = fromSeed(seed);
  const public_key = pair.public_key;
  const the_public_key = bs58.encode(buffer.slice(32, 64));
  if (public_key !== the_public_key) {
    throw new Error(
      `Invalid private key: public key mismatch: expected ${public_key}, got ${the_public_key}`,
    );
  }
  return pair;
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
 * Encrypt data with a public key (ED25519, base58 encoded)
 *
 * @param data - data to be encrypted
 * @param publicKey - the public key to encrypt the data with (base58 encoded)
 * @returns the encrypted data (Uint8Array)
 *
 * @public
 */
export const encryptByPublicKey = (data: Uint8Array, publicKey: string) => {
  const tempKeyPair = box.keyPair();
  const curvePublicKey = convertPublicKey(bs58.decode(publicKey));
  if (!curvePublicKey) throw new Error('Failed to convert public key to curve25519');
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const sharedKey = box.before(curvePublicKey, tempKeyPair.secretKey);
  const encryptedData = box.after(data, nonce, sharedKey);
  const combinedData = new Uint8Array(nonce.length + tempKeyPair.publicKey.length + encryptedData.length);
  combinedData.set(nonce, 0);
  combinedData.set(tempKeyPair.publicKey, nonce.length);
  combinedData.set(encryptedData, nonce.length + tempKeyPair.publicKey.length);
  return combinedData;
};

/**
 * Decrypt data with a private key (ED25519, base58 encoded)
 * @param data - encrypted data (Uint8Array)
 * @param privateKey - the private key to decrypt the data with (base58 encoded)
 * @returns the decrypted data (Uint8Array)
 * @public
 */
export const decryptByPrivateKey = (data: Uint8Array, privateKey: string) => {
  const privateKeyUint8Array = bs58.decode(privateKey);
  const curvePrivateKey = convertSecretKey(privateKeyUint8Array);
  if (!curvePrivateKey) throw new Error('Failed to convert private key to curve25519');
  // data = nonce(24) + publicKey(32) + encryptedData
  const nonce = data.slice(0, 24);
  const publicKey = data.slice(24, 56);
  const encryptedData = data.slice(56);
  const sharedKey = box.before(publicKey, curvePrivateKey);
  return box.open.after(encryptedData, nonce, sharedKey);
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

/**
 * Generate a new X25519 key pair (for key exchange)
 *
 * @returns the public key and the private key (both base58 encoded)
 * @public
 */
export const generateX25519KeyPair = (): { public_key: string; private_key: string } => {
  const { publicKey, secretKey } = box.keyPair();
  return { public_key: bs58.encode(publicKey), private_key: bs58.encode(secretKey) };
};

/**
 * Derive a shared AES-GCM 256-bits key from a public key (other's) and a private key (your's)
 * @param publicKey - the other's public key to derive the shared key from (base58 encoded)
 * @param privateKey - the your's private key to derive the shared key from (base58 encoded)
 * @returns the shared key (base58 encoded)
 * @public
 */
export const deriveSharedKey = (publicKey: string, privateKey: string): string => {
  const publicKeyUint8Array = bs58.decode(publicKey);
  const privateKeyUint8Array = bs58.decode(privateKey);
  const sharedKey = box.before(publicKeyUint8Array, privateKeyUint8Array);
  return bs58.encode(sharedKey);
};

/**
 * Convert a Uint8Array to a base58 encoded string
 * @param data - the data to encode
 * @returns the base58 encoded string
 * @public
 */
export const encodeBase58 = (data: Uint8Array): string => {
  return bs58.encode(data);
};

/**
 * Convert a base58 encoded string to a Uint8Array
 * @param data - the base58 data to decode
 * @returns the decoded Uint8Array
 * @public
 */
export const decodeBase58 = (data: string): Uint8Array => {
  return bs58.decode(data);
};

// isomorphic crypto both in browser and nodejs
// @ts-ignore
const crypto: typeof import('crypto') = globalThis.crypto || require('crypto');

/**
 * Encrypt data with AES-GCM (random IV)
 * @param data - the data to encrypt
 * @param base58_key - the key to encrypt the data with (base58 encoded)
 * @returns the encrypted data (IV + encrypted data)
 * @public
 */
export const encrypt = async (data: Uint8Array, base58_key: string): Promise<Uint8Array> => {
  const keyUint8Array = bs58.decode(base58_key);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 初始化向量
  const theKey = await crypto.subtle.importKey('raw', keyUint8Array, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, theKey, data);
  const combinedData = new Uint8Array(iv.length + encryptedData.byteLength);
  combinedData.set(iv, 0);
  combinedData.set(new Uint8Array(encryptedData), iv.length);
  return combinedData;
};

/**
 * Decrypt data with AES-GCM
 * @param data - the data to decrypt (IV + encrypted data)
 * @param base58_key - the key to decrypt the data with (base58 encoded)
 * @returns the decrypted data
 * @public
 */
export const decrypt = async (data: Uint8Array, base58_key: string): Promise<Uint8Array> => {
  const iv = data.slice(0, 12);
  const encryptedData = data.slice(12);
  const keyUint8Array = bs58.decode(base58_key);
  const theKey = await crypto.subtle.importKey('raw', keyUint8Array, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, theKey, encryptedData);
  return new Uint8Array(decrypted);
};

/**
 * Compute SHA-256 hash of the given data
 * @param data - the data to hash
 * @returns the SHA-256 hash of the data
 * @public
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  // Web Crypto API (browsers and Node.js >= 18)
  if (typeof globalThis.crypto.subtle.digest === 'function') {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }

  // Node.js 环境 (Node.js < 18)
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const crypto = require('crypto');
    return new Uint8Array(crypto.createHash('sha256').update(data).digest());
  }

  throw new Error('Unsupported environment: No crypto implementation found');
}
