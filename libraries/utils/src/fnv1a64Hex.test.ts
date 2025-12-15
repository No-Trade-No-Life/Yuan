import { TextEncoder } from 'util';

import { fnv1a64Hex } from './fnv1a64Hex';

describe('fnv1a64Hex', () => {
  it('should hash empty bytes', () => {
    expect(fnv1a64Hex(new Uint8Array())).toBe('cbf29ce484222325');
  });

  it('should hash hello', () => {
    expect(fnv1a64Hex(new TextEncoder().encode('hello'))).toBe('a430d84680aabd0b');
  });

  it('should hash foobar', () => {
    expect(fnv1a64Hex(new TextEncoder().encode('foobar'))).toBe('85944171f73967e8');
  });
});
