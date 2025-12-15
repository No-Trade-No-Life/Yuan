/**
 * Compute FNV-1a 64-bit hash and encode as 16-char lowercase hex string (zero padded).
 *
 * @public
 */
export const fnv1a64Hex = (bytes: Uint8Array): string => {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('fnv1a64Hex(bytes), bytes must be a Uint8Array');

  const FNV_OFFSET_64 = BigInt('14695981039346656037');
  const FNV_PRIME_64 = BigInt('1099511628211');
  const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);

  let x = FNV_OFFSET_64;
  for (const byte of bytes) {
    x ^= BigInt(byte);
    x = (x * FNV_PRIME_64) & MASK_64;
  }
  return x.toString(16).padStart(16, '0');
};
