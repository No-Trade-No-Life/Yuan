import { PromRegistry } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
// @ts-ignore
import CryptoJS from 'crypto-js';
import { IBinanceCredential } from './types';

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

const MetricBinanceApiUsedWeight = PromRegistry.create('gauge', 'binance_api_used_weight');

const recordUsedWeight = (res: Response) => {
  const header = res.headers.get('x-mbx-used-weight-1m') ?? res.headers.get('x-sapi-used-uid-weight-1m');
  if (header) {
    MetricBinanceApiUsedWeight.set(+header, {});
  }
};

const ensureQueryParams = (params: Record<string, any> | undefined, credential?: IBinanceCredential) => {
  const query = { ...(params || {}) };
  if (credential) {
    if (query.recvWindow === undefined) {
      query.recvWindow = 5000;
    }
    if (query.timestamp === undefined) {
      query.timestamp = Date.now();
    }
  }
  return query;
};

const applyQueryParams = (url: URL, params: Record<string, any>) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
};

const callApi = async <T>(
  method: HttpMethod,
  path: string,
  params?: Record<string, any>,
  credential?: IBinanceCredential,
): Promise<T> => {
  const url = new URL(path);
  const query = ensureQueryParams(params, credential);
  applyQueryParams(url, query);
  const headers: Record<string, string> = { 'Content-Type': 'application/json;charset=utf-8' };
  if (!credential) {
    console.info(formatTime(Date.now()), 'BinanceRequest', method, url.href);
  } else {
    const signData = url.searchParams.toString();
    const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(signData, credential.secret_key));
    url.searchParams.set('signature', signature);
    headers['X-MBX-APIKEY'] = credential.access_key;
    console.info(formatTime(Date.now()), 'BinanceRequest', method, url.href, signData);
  }
  const res = await fetch(url.href, { method, headers });
  recordUsedWeight(res);
  const text = await res.text();
  try {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'BinanceResponse', method, url.href, text);
    }
    return JSON.parse(text);
  } catch (err) {
    console.error(formatTime(Date.now()), 'BinanceParseFailed', method, url.href, text);
    throw err;
  }
};

export const requestPublic = <T = any>(method: HttpMethod, path: string, params?: Record<string, any>) =>
  callApi<T>(method, path, params);

export const requestPrivate = <T = any>(
  credential: IBinanceCredential,
  method: HttpMethod,
  path: string,
  params?: Record<string, any>,
) => callApi<T>(method, path, params, credential);

export const getDefaultCredential = (): IBinanceCredential => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    throw new Error('Missing Binance credential: ACCESS_KEY / SECRET_KEY');
  }
  return { access_key, secret_key };
};
