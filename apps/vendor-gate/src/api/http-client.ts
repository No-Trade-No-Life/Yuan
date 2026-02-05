import { fetch, selectHTTPProxyIpRoundRobinAsync } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { encodeHex, formatTime, HmacSHA512, sha512 } from '@yuants/utils';
import { join } from 'path';

const BASE_URL = 'https://api.gateio.ws/api/v4';
const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;
const terminal = Terminal.fromNodeEnv();
const MISSING_PUBLIC_IP_LOG_INTERVAL = 3_600_000;
const missingPublicIpLogAtByTerminalId = new Map<string, number>();

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

export type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

export type GateParams = Record<string, string | number | boolean | undefined>;

export interface IGateCredential {
  access_key: string;
  secret_key: string;
}

type RequestContext = { ip: string };

const resolveLocalPublicIp = (): string => {
  const ip = terminal.terminalInfo.tags?.public_ip?.trim();
  if (ip) return ip;
  const now = Date.now();
  const lastLoggedAt = missingPublicIpLogAtByTerminalId.get(terminal.terminal_id) ?? 0;
  if (now - lastLoggedAt > MISSING_PUBLIC_IP_LOG_INTERVAL) {
    missingPublicIpLogAtByTerminalId.set(terminal.terminal_id, now);
    console.info(formatTime(Date.now()), 'missing terminal public_ip tag, fallback to public-ip-unknown');
  }
  return 'public-ip-unknown';
};

const createRequestContext = async (): Promise<RequestContext> => {
  if (shouldUseHttpProxy) {
    const ip = await selectHTTPProxyIpRoundRobinAsync(terminal);
    return { ip };
  }
  return { ip: resolveLocalPublicIp() };
};

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
    // 只在 DEBUG 模式下打印完整响应文本，避免泄露敏感信息
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'GateRequestFailed', path, JSON.stringify(params ?? {}), text, {
        status: response.status,
        headers: toHeaderObject(response.headers),
      });
    } else {
      // 非 DEBUG 模式下只打印摘要
      const textPreview = text.length > 100 ? text.substring(0, 100) + '...' : text;
      console.info(
        formatTime(Date.now()),
        'GateRequestFailed',
        path,
        JSON.stringify(params ?? {}),
        textPreview,
        {
          status: response.status,
          headers: toHeaderObject(response.headers),
        },
      );
    }
    throw error;
  }
};

export const requestPublic = async <TResponse>(
  method: HttpMethod,
  path: string,
  params?: GateParams,
): Promise<TResponse> => {
  const { url, body } = createRequestArtifacts(method, path, params);
  const requestContext = await createRequestContext();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  console.info(formatTime(Date.now()), method, url.href);

  // 添加请求超时控制（30秒）
  const timeoutMs = 30_000;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error(`Request timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetchImpl(url.href, {
      method,
      headers,
      body: body || undefined,
      signal: abortController.signal,
      ...(shouldUseHttpProxy
        ? {
            labels: requestContext.ip ? { ip: requestContext.ip } : undefined,
            terminal,
          }
        : {}),
    });
    return await parseJSON<TResponse>(response, path, params);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const requestPrivate = async <TResponse>(
  credential: IGateCredential,
  method: HttpMethod,
  path: string,
  params?: GateParams,
): Promise<TResponse> => {
  const { url, body } = createRequestArtifacts(method, path, params);
  const requestContext = await createRequestContext();
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

  // 安全日志：过滤敏感头信息
  const safeHeaders = { ...headers };
  if (safeHeaders.KEY) safeHeaders.KEY = '***';
  if (safeHeaders.SIGN) safeHeaders.SIGN = '***';
  console.info(formatTime(Date.now()), method, url.href, JSON.stringify(safeHeaders), body);

  // 添加请求超时控制（30秒）
  const timeoutMs = 30_000;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error(`Request timeout after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetchImpl(url.href, {
      method,
      headers,
      body: body || undefined,
      signal: abortController.signal,
      ...(shouldUseHttpProxy
        ? {
            labels: requestContext.ip ? { ip: requestContext.ip } : undefined,
            terminal,
          }
        : {}),
    });
    return await parseJSON<TResponse>(response, path, params);
  } finally {
    clearTimeout(timeoutId);
  }
};
