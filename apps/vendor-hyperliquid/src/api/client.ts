import { fetch, selectHTTPProxyIpRoundRobin } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { UUID, formatTime, newError } from '@yuants/utils';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';
import { afterRestResponse, beforeRestRequest, getRestRequestContext } from './rate-limit';

void afterRestResponse;

type HttpMethod = 'GET' | 'POST';

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

const createRequestContext = (): RequestContext => {
  if (shouldUseHttpProxy) {
    const ip = selectHTTPProxyIpRoundRobin(terminal);
    return { ip };
  }
  return { ip: resolveLocalPublicIp() };
};

const BASE_URL = 'https://api.hyperliquid.xyz';
const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;
const terminal = Terminal.fromNodeEnv();
const MISSING_PUBLIC_IP_LOG_INTERVAL = 3_600_000;
const missingPublicIpLogAtByTerminalId = new Map<string, number>();

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

const getRequestKey = (ctx: ReturnType<typeof getRestRequestContext>) => {
  if (ctx.kind === 'info') return `info:${ctx.infoType ?? 'unknown'}`;
  if (ctx.kind === 'exchange') return `exchange:${ctx.exchangeActionType ?? 'unknown'}`;
  if (ctx.kind === 'explorer') return `explorer:${ctx.path}`;
  return `other:${ctx.path}`;
};

const buildUrl = (path: string, method: HttpMethod, params?: any) => {
  const url = new URL(BASE_URL);
  url.pathname = path;
  if (method === 'GET' && params) {
    const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
    for (const [key, value] of entries) {
      url.searchParams.set(key, '' + value);
    }
  }
  return url;
};

const callApi = async (method: HttpMethod, path: string, params?: any) => {
  const url = buildUrl(path, method, params);
  const body = method === 'GET' ? '' : JSON.stringify(params ?? {});
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  console.info(formatTime(Date.now()), 'HyperliquidRequest', method, url.host, url.pathname);

  const requestContext = getRestRequestContext(method, path, params);
  const requestKey = getRequestKey(requestContext);
  const proxyContext = createRequestContext();

  beforeRestRequest(
    { method, url: url.href, path, kind: requestContext.kind, infoType: requestContext.infoType, requestKey },
    requestContext,
    proxyContext.ip,
  );

  const res = await fetchImpl(
    url.href,
    shouldUseHttpProxy
      ? {
          method,
          headers,
          body: method === 'GET' ? undefined : body || undefined,
          labels: proxyContext.ip ? { ip: proxyContext.ip } : undefined,
          terminal,
        }
      : {
          method,
          headers,
          body: method === 'GET' ? undefined : body || undefined,
        },
  );
  const retStr = await res.text();
  if (res.status === 429) {
    console.info(
      formatTime(Date.now()),
      'HyperliquidResponse',
      method,
      url.host,
      url.pathname,
      `status=${res.status}`,
    );
    throw newError('HYPERLIQUID_HTTP_429', {
      status: res.status,
      requestKey,
      method,
      path,
      url: `${url.host}${url.pathname}`,
    });
  }
  try {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'HyperliquidResponse', path, retStr);
    }
    const response = JSON.parse(retStr);
    // await afterRestResponse(
    //   {
    //     method,
    //     url: url.href,
    //     path,
    //     kind: requestContext.kind,
    //     infoType: requestContext.infoType,
    //     requestKey,
    //   },
    //   requestContext,
    //   response,
    //   estimatedExtraWeight,
    // );
    return response;
  } catch (err) {
    console.error(formatTime(Date.now()), 'HyperliquidRequestFailed', path, retStr, err);
    throw err;
  }
};

type FlowController = {
  requestQueue: Array<{ trace_id: string; method: HttpMethod; path: string; params?: any }>;
  responseChannel: Subject<{ trace_id: string; response?: any; error?: Error }>;
};

const controllers = new Map<string, FlowController>();

const ensureController = (path: string, period: number, limit: number) => {
  if (controllers.has(path)) {
    return controllers.get(path)!;
  }
  const controller: FlowController = {
    requestQueue: [],
    responseChannel: new Subject(),
  };
  timer(0, period)
    .pipe(
      filter(() => controller.requestQueue.length > 0),
      mergeMap(() => controller.requestQueue.splice(0, limit)),
      mergeMap(async (request) => {
        try {
          const response = await callApi(request.method, request.path, request.params);
          return { trace_id: request.trace_id, response };
        } catch (error) {
          return { trace_id: request.trace_id, error: error as Error };
        }
      }),
    )
    .subscribe(controller.responseChannel);
  controllers.set(path, controller);
  return controller;
};

export const request = <T = any>(method: HttpMethod, path: string, params?: any) =>
  callApi(method, path, params) as Promise<T>;

export const requestWithFlowControl = async <T = any>(
  method: HttpMethod,
  path: string,
  flowControl: { period: number; limit: number },
  params?: any,
) => {
  const controller = ensureController(path, flowControl.period, flowControl.limit);
  const trace_id = UUID();
  const res$ = controller.responseChannel.pipe(
    filter((resp) => resp.trace_id === trace_id),
    mergeMap((resp) => (resp.error ? throwError(() => resp.error) : of(resp))),
    timeout(30_000),
    shareReplay(1),
  );
  controller.requestQueue.push({ trace_id, method, path, params });
  return ((await firstValueFrom(res$)).response ?? null) as T;
};
