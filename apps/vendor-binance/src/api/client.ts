import { GlobalPrometheusRegistry } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
// @ts-ignore
import CryptoJS from 'crypto-js';

const MetricBinanceApiUsedWeight = GlobalPrometheusRegistry.gauge('binance_api_used_weight', '');

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

type RequestParams = Record<string, string | number | boolean | undefined>;

export interface ICredential {
  access_key: string;
  secret_key: string;
}

export interface IApiError {
  code: number;
  msg: string;
}

export const isApiError = <T>(value: T | IApiError): value is IApiError =>
  typeof (value as IApiError)?.code === 'number' && typeof (value as IApiError)?.msg === 'string';

const appendParams = (url: URL, params?: RequestParams) => {
  if (!params) return;
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });
};

const callApi = async <T>(
  method: HttpMethod,
  endpoint: string,
  params?: RequestParams,
  credential?: ICredential,
): Promise<T> => {
  const url = new URL(endpoint);
  const normalizedParams: RequestParams = { ...params };
  if (credential) {
    if (normalizedParams.recvWindow === undefined) {
      normalizedParams.recvWindow = 5000;
    }
    if (normalizedParams.timestamp === undefined) {
      normalizedParams.timestamp = Date.now();
    }
  }
  appendParams(url, normalizedParams);

  let headers: Record<string, string> | undefined;
  if (credential) {
    const signData = url.search.slice(1);
    const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(signData, credential.secret_key));
    url.searchParams.set('signature', signature);
    headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'X-MBX-APIKEY': credential.access_key,
    };
    console.info(
      formatTime(Date.now()),
      method,
      url.href,
      JSON.stringify(headers),
      url.searchParams.toString(),
      signData,
    );
  } else {
    console.info(formatTime(Date.now()), method, url.href);
  }

  const res = await fetch(url.href, {
    method,
    headers,
  });
  const usedWeight1M = res.headers.get('x-mbx-used-weight-1m');
  console.info(
    formatTime(Date.now()),
    'response',
    method,
    url.href,
    res.status,
    `usedWeight1M=${usedWeight1M ?? 'N/A'}`,
  );
  if (usedWeight1M) {
    MetricBinanceApiUsedWeight.set(+usedWeight1M);
  }
  return res.json() as Promise<T>;
};

export const requestPublic = <T>(method: HttpMethod, endpoint: string, params?: RequestParams) =>
  callApi<T>(method, endpoint, params);

export const requestPrivate = <T>(
  credential: ICredential,
  method: HttpMethod,
  endpoint: string,
  params?: RequestParams,
) => callApi<T>(method, endpoint, params, credential);

export const getDefaultCredential = (): ICredential => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    throw new Error('Missing Binance credential: ACCESS_KEY and SECRET_KEY must be set');
  }
  return { access_key, secret_key };
};
