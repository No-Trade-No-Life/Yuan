import { encodeHex, formatTime, HmacSHA512, sha512 } from '@yuants/utils';
import { join } from 'path';

const BASE_URL = 'https://api.gateio.ws/api/v4';

export type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

export type GateParams = Record<string, string | number | boolean | undefined>;

export interface IGateCredential {
  access_key: string;
  secret_key: string;
}

interface IRequestArtifacts {
  url: URL;
  body: string;
}

const serializeQueryParams = (params?: GateParams): Record<string, string> | undefined => {
  if (!params) return undefined;
  const normalizedEntries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (normalizedEntries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(normalizedEntries.map(([key, value]) => [key, `${value}`]));
};

const createRequestArtifacts = (method: HttpMethod, path: string, params?: GateParams): IRequestArtifacts => {
  const url = new URL(BASE_URL);
  url.pathname = join(url.pathname, path);
  const searchParams = serializeQueryParams(params);
  if (method === 'GET' && searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  const rawBody = method === 'GET' ? '' : JSON.stringify(params);
  const body = rawBody;
  return { url, body };
};

const toHeaderObject = (headers: Headers): Record<string, string> => {
  const iterable = headers as unknown as Iterable<[string, string]>;
  return Object.fromEntries(Array.from(iterable));
};

const parseJSON = async <TResponse>(
  response: Response,
  path: string,
  params?: GateParams,
): Promise<TResponse> => {
  const text = await response.text();
  if (process.env.LOG_LEVEL === 'DEBUG') {
    console.debug(formatTime(Date.now()), 'GateResponse', path, JSON.stringify(params ?? {}), text, {
      status: response.status,
      headers: toHeaderObject(response.headers),
    });
  }
  try {
    return JSON.parse(text) as TResponse;
  } catch (error) {
    console.info(formatTime(Date.now()), 'GateRequestFailed', path, JSON.stringify(params ?? {}), text, {
      status: response.status,
      headers: toHeaderObject(response.headers),
    });
    throw error;
  }
};

export const requestPublic = async <TResponse>(
  method: HttpMethod,
  path: string,
  params?: GateParams,
): Promise<TResponse> => {
  const { url, body } = createRequestArtifacts(method, path, params);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  console.info(formatTime(Date.now()), method, url.href);
  const response = await fetch(url.href, {
    method,
    headers,
    body: body || undefined,
  });
  return parseJSON<TResponse>(response, path, params);
};

export const requestPrivate = async <TResponse>(
  credential: IGateCredential,
  method: HttpMethod,
  path: string,
  params?: GateParams,
): Promise<TResponse> => {
  const { url, body } = createRequestArtifacts(method, path, params);
  const timestamp = Date.now() / 1000;

  const bodyDigest = encodeHex(await sha512(new TextEncoder().encode(body)));
  const signTarget = `${method}\n${url.pathname}\n${url.searchParams}\n${bodyDigest}\n${timestamp}`;
  const sign = encodeHex(
    await HmacSHA512(new TextEncoder().encode(signTarget), new TextEncoder().encode(credential.secret_key)),
  );

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    KEY: credential.access_key,
    SIGN: sign,
    Timestamp: `${timestamp}`,
  };

  // Add Channel ID header if exists
  if (process.env.CHANNEL_ID) {
    headers['X-Gate-Channel-Id'] = process.env.CHANNEL_ID;
  }

  console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body);

  const response = await fetch(url.href, {
    method,
    headers,
    body: body || undefined,
  });
  return parseJSON<TResponse>(response, path, params);
};
