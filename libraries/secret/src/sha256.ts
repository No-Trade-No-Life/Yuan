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
