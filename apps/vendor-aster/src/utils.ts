export function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexArray: string[] = [];

  for (const byte of bytes) {
    const hex = byte.toString(16).padStart(2, '0');
    hexArray.push(hex);
  }

  return hexArray.join('');
}

export async function opensslEquivalentHMAC(message: string, secretKey: string): Promise<string> {
  try {
    const keyBuffer = new TextEncoder().encode(secretKey);
    const messageBuffer = new TextEncoder().encode(message);

    // 导入密钥
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      {
        name: 'HMAC',
        hash: { name: 'SHA-256' },
      },
      false,
      ['sign'],
    );

    // 进行 HMAC-SHA256 签名
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);

    // 转换为16进制小写（与 openssl 输出格式一致）
    return arrayBufferToHex(signature);
  } catch (error) {
    throw new Error(`HMAC-SHA256 签名失败: ${error}`);
  }
}
