import bs58 from 'bs58';

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
