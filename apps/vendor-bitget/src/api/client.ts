import { fetch, selectHTTPProxyIpRoundRobinAsync } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { HmacSHA256, UUID, encodeBase64, encodePath, formatTime } from '@yuants/utils';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';
import { ICredential } from './types';

const BASE_URL = 'https://api.bitget.com';
const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;
const terminal = Terminal.fromNodeEnv();
const MISSING_PUBLIC_IP_LOG_INTERVAL = 3_600_000;
const missingPublicIpLogAtByTerminalId = new Map<string, number>();

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT';

type FlowControlConfig = { period: number; limit: number };

type QueueItem = {
  trace_id: string;
  credential?: ICredential;
  method: HttpMethod;
  path: string;
  params?: Record<string, unknown>;
  requestContext: RequestContext;
};

type QueueResponse = { trace_id: string; response?: unknown; error?: Error };

type FlowController = {
  requestQueue: QueueItem[];
  responseChannel: Subject<QueueResponse>;
};

const flowControllers = new Map<string, FlowController>();

type RequestContext = { ip: string };

const buildFlowControllerKey = (baseKey: string, ip: string) => encodePath([baseKey, ip]);

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

const createUrl = (path: string, method: HttpMethod, params?: Record<string, unknown>) => {
  const url = new URL(BASE_URL);
  url.pathname = path;
  if (method === 'GET' && params) {
    const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    for (const [k, v] of sorted) {
      url.searchParams.set(k, '' + v);
    }
  }
  return url;
};

const buildHeaders = async (
  credential: ICredential | undefined,
  method: HttpMethod,
  url: URL,
  body: string,
) => {
  if (!credential) {
    return { 'Content-Type': 'application/json' } as Record<string, string>;
  }
  const timestamp = '' + Date.now();
  const signData = timestamp + method + url.pathname + url.search + body;
  const signature = encodeBase64(
    await HmacSHA256(new TextEncoder().encode(signData), new TextEncoder().encode(credential.secret_key)),
  );
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ACCESS-KEY': credential.access_key,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': credential.passphrase,
  };
  // Add Channel ID header if exists
  if (process.env.CHANNEL_ID) {
    headers['X-CHANNEL-API-CODE'] = process.env.CHANNEL_ID;
  }
  return headers;
};

const callApi = async <TResponse>(
  credential: ICredential | undefined,
  method: HttpMethod,
  path: string,
  params?: Record<string, unknown>,
  requestContext?: RequestContext,
): Promise<TResponse> => {
  const url = createUrl(path, method, params);
  const body = method === 'GET' || params === undefined ? '' : JSON.stringify(params);
  const headers = await buildHeaders(credential, method, url, body);
  const init: RequestInit = {
    method,
    headers,
    body: method === 'GET' ? undefined : body || undefined,
  };
  console.info(formatTime(Date.now()), method, url.href, method === 'GET' ? '' : init.body || '');
  const res = await fetchImpl(
    url.href,
    shouldUseHttpProxy
      ? {
          ...init,
          labels: requestContext?.ip ? { ip: requestContext.ip } : undefined,
          terminal,
        }
      : init,
  );
  const retStr = await res.text();
  try {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'BitgetResponse', path, JSON.stringify(params), retStr);
    }
    return JSON.parse(retStr) as TResponse;
  } catch (err) {
    console.error(formatTime(Date.now()), 'BitgetRequestFailed', path, JSON.stringify(params), retStr);
    throw err;
  }
};

const getFlowControllerKey = (
  credential: ICredential | undefined,
  path: string,
  requestContext: RequestContext,
) => buildFlowControllerKey(`${credential ? credential.access_key : 'PUBLIC'}:${path}`, requestContext.ip);

const ensureFlowController = (key: string, config: FlowControlConfig) => {
  if (flowControllers.has(key)) {
    return flowControllers.get(key)!;
  }
  const controller: FlowController = {
    requestQueue: [],
    responseChannel: new Subject<QueueResponse>(),
  };
  timer(0, config.period)
    .pipe(
      filter(() => controller.requestQueue.length > 0),
      mergeMap(() => controller.requestQueue.splice(0, config.limit)),
      mergeMap(async (request) => {
        try {
          const response = await callApi(
            request.credential,
            request.method,
            request.path,
            request.params,
            request.requestContext,
          );
          return { trace_id: request.trace_id, response };
        } catch (error) {
          return { trace_id: request.trace_id, error: error as Error };
        }
      }),
    )
    .subscribe(controller.responseChannel);
  flowControllers.set(key, controller);
  return controller;
};

const requestWithFlowControl = async <TResponse>(
  credential: ICredential | undefined,
  method: HttpMethod,
  path: string,
  config: FlowControlConfig,
  params?: Record<string, unknown>,
): Promise<TResponse> => {
  const requestContext = await createRequestContext();
  const key = getFlowControllerKey(credential, path, requestContext);
  const controller = ensureFlowController(key, config);
  const trace_id = UUID();
  const res$ = controller.responseChannel.pipe(
    filter((resp) => resp.trace_id === trace_id),
    mergeMap((resp) => (resp.error ? throwError(() => resp.error) : of(resp))),
    timeout(30_000),
    shareReplay(1),
  );
  controller.requestQueue.push({ trace_id, credential, method, path, params, requestContext });
  return (await firstValueFrom(res$)).response as TResponse;
};

export const requestPublic = async <T = unknown>(
  method: HttpMethod,
  path: string,
  params?: Record<string, unknown>,
) => callApi<T>(undefined, method, path, params, await createRequestContext());
export const requestPrivate = async <T = unknown>(
  credential: ICredential,
  method: HttpMethod,
  path: string,
  params?: Record<string, unknown>,
) => callApi<T>(credential, method, path, params, await createRequestContext());
export const requestPublicWithFlowControl = <T = unknown>(
  method: HttpMethod,
  path: string,
  config: FlowControlConfig,
  params?: Record<string, unknown>,
) => requestWithFlowControl<T>(undefined, method, path, config, params);
export const requestPrivateWithFlowControl = <T = unknown>(
  credential: ICredential,
  method: HttpMethod,
  path: string,
  config: FlowControlConfig,
  params?: Record<string, unknown>,
) => requestWithFlowControl<T>(credential, method, path, config, params);

export const getDefaultCredential = (): ICredential => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  const passphrase = process.env.PASSPHRASE;
  if (!access_key || !secret_key || !passphrase) {
    throw new Error('Missing Bitget credential: ACCESS_KEY / SECRET_KEY / PASSPHRASE must be set');
  }
  return { access_key, secret_key, passphrase };
};
