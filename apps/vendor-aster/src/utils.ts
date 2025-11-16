export function uint8ArrayToHex(bytes: Uint8Array): string {
  const hexArray: string[] = [];

  for (const byte of bytes) {
    const hex = byte.toString(16).padStart(2, '0');
    hexArray.push(hex);
  }

  return hexArray.join('');
}
