import { UUID, formatTime, newError } from '@yuants/utils';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';
import { afterRestResponse, beforeRestRequest, getRestRequestContext } from './rate-limit';

type HttpMethod = 'GET' | 'POST';

const BASE_URL = 'https://api.hyperliquid.xyz';

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
  console.info(formatTime(Date.now()), method, url.href, body);

  const requestContext = getRestRequestContext(method, path, params);
  const requestKey = getRequestKey(requestContext);

  const { estimatedExtraWeight } = beforeRestRequest(
    { method, url: url.href, path, kind: requestContext.kind, infoType: requestContext.infoType, requestKey },
    requestContext,
  );

  const res = await fetch(url.href, {
    method,
    headers,
    body: method === 'GET' ? undefined : body || undefined,
  });
  const retStr = await res.text();
  if (res.status === 429) {
    console.info(
      formatTime(Date.now()),
      'HyperliquidResponse',
      method,
      url.href,
      `status=${res.status}`,
      retStr,
    );
    throw newError('HYPERLIQUID_HTTP_429', {
      status: res.status,
      requestKey,
      method,
      path,
      url: url.href,
      response: retStr,
    });
  }
  try {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'HyperliquidResponse', path, JSON.stringify(params), retStr);
    }
    const response = JSON.parse(retStr);
    await afterRestResponse(
      {
        method,
        url: url.href,
        path,
        kind: requestContext.kind,
        infoType: requestContext.infoType,
        requestKey,
      },
      requestContext,
      response,
      estimatedExtraWeight,
    );
    return response;
  } catch (err) {
    console.error(
      formatTime(Date.now()),
      'HyperliquidRequestFailed',
      path,
      JSON.stringify(params),
      retStr,
      err,
    );
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
