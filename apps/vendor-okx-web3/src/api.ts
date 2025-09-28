import { formatTime } from '@yuants/utils';
import crypto from 'crypto';

export class OKXWeb3Client {
  constructor(
    public config: {
      auth: {
        api_key: string;
        secret_key: string;
        passphrase: string;
      };
    },
  ) {}

  async request(method: string, path: string, params: any) {
    const url = new URL('https://web3.okx.com');
    url.pathname = path;
    if (method === 'GET') {
      for (const key in params) {
        url.searchParams.set(key, params[key]);
      }
    }
    const timestamp = formatTime(Date.now(), 'UTC').replace(' ', 'T');
    const secret_key = this.config.auth.secret_key;
    const body = method === 'GET' ? '' : JSON.stringify(params);
    const signData = timestamp + method + url.pathname + url.search + body;
    const str = crypto.createHmac('sha256', secret_key).update(signData).digest('base64');

    const headers = {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': this.config.auth.api_key!,
      'OK-ACCESS-SIGN': str,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.config.auth.passphrase,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });
    return res.json();
  }
}

export const client = new OKXWeb3Client({
  auth: {
    api_key: process.env.ACCESS_KEY!,
    secret_key: process.env.SECRET_KEY!,
    passphrase: process.env.PASSPHRASE!,
  },
});
