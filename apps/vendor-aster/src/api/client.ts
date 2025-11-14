import { opensslEquivalentHMAC } from '../utils';
import { IAsterCredential } from './types';

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

type RequestOptions = {
  baseUrl: string;
  method: HttpMethod;
  path: string;
  params?: Record<string, any>;
  credential?: IAsterCredential;
  signed?: boolean;
};

const FAPI_BASE_URL = 'https://fapi.asterdex.com';
const SAPI_BASE_URL = 'https://sapi.asterdex.com';

const buildUrl = (baseUrl: string, path: string, params?: Record<string, any>) => {
  const url = new URL(baseUrl);
  url.pathname = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, `${value}`);
    }
  }
  return url;
};

const request = async <T>({ baseUrl, method, path, params, credential, signed }: RequestOptions): Promise<T> => {
  const url = buildUrl(baseUrl, path, params);
  const headers: Record<string, string> = {};
  if (signed) {
    if (!credential) {
      throw new Error('Credential is required for signed requests');
    }
    url.searchParams.set('timestamp', `${Date.now()}`);
    const message = url.search.slice(1);
    const signature = await opensslEquivalentHMAC(message, credential.secret_key);
    url.searchParams.set('signature', signature);
    headers['X-MBX-APIKEY'] = credential.access_key;
  } else if (credential) {
    headers['X-MBX-APIKEY'] = credential.access_key;
  }

  const response = await fetch(url.toString(), { method, headers });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    if (json.code && json.code !== 0) {
      throw new Error(typeof json === 'string' ? json : JSON.stringify(json));
    }
    return json;
  } catch (err) {
    console.error('AsterRequestFailed', method, url.toString(), text);
    throw err;
  }
};

export const requestPerpetualPublic = <T>(method: HttpMethod, path: string, params?: Record<string, any>) =>
  request<T>({ baseUrl: FAPI_BASE_URL, method, path, params });

export const requestPerpetualPrivate = <T>(
  credential: IAsterCredential,
  method: HttpMethod,
  path: string,
  params?: Record<string, any>,
) => request<T>({ baseUrl: FAPI_BASE_URL, method, path, params, credential, signed: true });

export const requestSpotPublic = <T>(method: HttpMethod, path: string, params?: Record<string, any>) =>
  request<T>({ baseUrl: SAPI_BASE_URL, method, path, params });

export const requestSpotPrivate = <T>(
  credential: IAsterCredential,
  method: HttpMethod,
  path: string,
  params?: Record<string, any>,
) => request<T>({ baseUrl: SAPI_BASE_URL, method, path, params, credential, signed: true });

export const getDefaultCredential = (): IAsterCredential => {
  const access_key = process.env.ACCESS_KEY ?? process.env.API_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    throw new Error('Missing Aster credential: ACCESS_KEY/API_KEY or SECRET_KEY is not set');
  }
  return { access_key, secret_key };
};
