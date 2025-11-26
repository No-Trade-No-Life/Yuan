import { decodeBase58, fromPrivateKey, HmacSHA256, scopeError, signMessageByEd25519 } from '@yuants/utils';

export interface ICredential {
  /**
   * ED25519 Private KEY (base58)
   */
  private_key: string;
}

const BASE_URL = 'https://surfv2-api.surf.one';

export const publicRequest = async (method: string, path: string, params: any = {}) => {
  const url = new URL(BASE_URL);
  url.pathname = path;

  if (method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, `${value}`);
    }
  }

  const response = await fetch(url.toString(), {
    method,
    body: method === 'POST' ? JSON.stringify(params) : undefined,
  });

  const text = await response.text();

  console.info(url.toString(), text);

  return scopeError('TurboAPIError', { status: response.status, statusText: response.statusText, text }, () =>
    JSON.parse(text),
  );
};

export const createPublicApi =
  <T, K>(method: string, path: string) =>
  (params: T): Promise<K> =>
    publicRequest(method, path, params);

/**
 * 获取账户信息
 */
export const getPoolPairList = createPublicApi<
  void,
  {
    errno: string;
    msg: string;
    data: {
      pair_id: string;
      base_token: string;
      quote_token: string;
      base_token_logo: string;
      base_token_name: string;
      volume_24h: string;
      price: string;
      c: string;
      max_leverage: number;
      avg_order_book_fee: string;
      funding_fee_interval: number;
      created_at: string;
      tag_id_list: number[];
    }[];
  }
>('GET', '/pool/pair/list');
