// @ts-ignore
import CryptoJS from 'crypto-js';
interface IHuobiParams {
  auth: { access_key: string; secret_key: string };
}

class HuobiClient {
  api_root = 'api.huobi.pro';
  constructor(public params: IHuobiParams) {}

  async request(method: string, path: string, params?: any) {
    const requestParams = `AccessKeyId=${
      this.params.auth.access_key
    }&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=${encodeURIComponent(
      new Date().toISOString().split('.')[0],
    )}${
      method === 'GET' && params !== undefined
        ? `&${Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join('&')}`
        : ''
    }`;

    const body = method === 'GET' ? '' : JSON.stringify(params);

    const requestString = `${method}\n${this.api_root}\n${path}\n${requestParams}`;

    const str = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(requestString, this.params.auth.secret_key),
    );

    const url = new URL(
      `https://${this.api_root}${path}?${requestParams}&Signature=${encodeURIComponent(str)}`,
    );
    // url.searchParams.sort();
    console.info(method, url.href, body);
    const res = await fetch(url.href, {
      method,
      body: body || undefined,
    });

    return res.json();
  }

  getAccountInfo(): Promise<{
    status: string;
    data: {
      id: number;
      type: string;
      state: string;
      subtype: string;
    }[];
  }> {
    return this.request('GET', '/v1/account/accounts');
  }
}
