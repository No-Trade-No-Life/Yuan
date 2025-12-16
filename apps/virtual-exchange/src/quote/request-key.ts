import { TextEncoder } from 'util';

import { fnv1a64Hex } from '@yuants/utils';

const SEP_BYTE = new Uint8Array([0xff]);

const encodeStrings = (parts: string[]): Uint8Array => {
  const buffers: Uint8Array[] = [];
  for (const part of parts) {
    buffers.push(new TextEncoder().encode(part));
    buffers.push(SEP_BYTE);
  }
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
};

export const fnv1a64HexFromStrings = (parts: string[]): string => fnv1a64Hex(encodeStrings(parts));
