import { newError } from './error';

/**
 * Encode Uint8Array to hex string
 * @param data - input data
 * @returns hex string (lowercase)
 * @public
 */
export const encodeHex = (data: Uint8Array): string => {
  if (!(data instanceof Uint8Array)) throw new TypeError('encodeHex(data), data must be a Uint8Array');

  // Uint8Array.prototype.toHex 方法存在时优先使用 (chrome 140+ 和 Node.js 25+ 支持)
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toHex

  // @ts-ignore
  if (typeof data.toHex === 'function') {
    // @ts-ignore
    return data.toHex();
  }

  // Node.js (< 25) 环境下 使用 Buffer
  if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
    return Buffer.from(data).toString('hex');
  }

  // 低版本浏览器环境下 手动实现编码
  return Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Decode hex string to Uint8Array
 * @param data - hex string (case insensitive)
 * @returns Uint8Array
 * @public
 */
export const decodeHex = (data: string): Uint8Array => {
  if (typeof data !== 'string') throw new TypeError('decodeHex(data), data must be a string');
  // Uint8Array.fromHex 方法存在时优先使用 (chrome 140+ 和 Node.js 25+ 支持)
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromHex
  // @ts-ignore
  if (typeof Uint8Array.fromHex === 'function') {
    // @ts-ignore
    return Uint8Array.fromHex(data);
  }

  // Node.js (< 25) 环境下使用 Buffer
  if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
    return new Uint8Array(Buffer.from(data, 'hex'));
  }

  // 手动实现解码 (不区分大小写)
  if (data.length % 2 !== 0) {
    throw newError('decodeHex_InvalidLength', {
      message: 'Hex string length must be even',
      length: data.length,
    });
  }
  const result = new Uint8Array(data.length / 2);
  for (let i = 0; i < data.length; i += 2) {
    result[i / 2] = parseInt(data.substring(i, i + 2), 16);
  }
  return result;
};
