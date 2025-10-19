import { fromUint8Array, toUint8Array } from 'js-base64';

/**
 * 将 Uint8Array 编码为 Base64 字符串
 * @param data - 要编码的数据
 * @returns Base64 编码的字符串
 * @public
 */
export const encodeBase64 = (data: Uint8Array): string => {
  // Uint8Array.prototype.toBase64 方法存在时优先使用 (chrome 140+ 和 Node.js 25+ 支持)
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64

  // @ts-ignore
  if (typeof data.toBase64 === 'function') {
    // @ts-ignore
    return data.toBase64();
  }

  // Node.js (< 25) 环境下 使用 Buffer
  if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
    return Buffer.from(data).toString('base64');
  }

  // 低版本浏览器环境下 使用 btoa
  if (typeof btoa === 'function') {
    return btoa(Array.from(data, (byte) => String.fromCharCode(byte)).join(''));
  }

  // 使用 js-base64 库编码
  return fromUint8Array(data);
};

/**
 * 将 Base64 字符串解码为 Uint8Array
 * @param data - Base64 编码的字符串
 * @returns 解码后的 Uint8Array
 * @public
 */
export const decodeBase64 = (data: string): Uint8Array => {
  // Uint8Array.fromBase64 方法存在时优先使用 (chrome 140+ 和 Node.js 25+ 支持)
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64

  // @ts-ignore
  if (typeof Uint8Array.fromBase64 === 'function') {
    // @ts-ignore
    return Uint8Array.fromBase64(data);
  }

  // Node.js (< 25) 环境下使用 Buffer
  if (typeof Buffer === 'function' && typeof Buffer.from === 'function') {
    return new Uint8Array(Buffer.from(data, 'base64'));
  }

  // 低版本浏览器环境下 使用 atob 解码 Base64 为二进制字符串
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
  }

  // 使用 js-base64 库解码
  return toUint8Array(data);
};
