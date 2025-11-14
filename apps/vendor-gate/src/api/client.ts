import { UUID, formatTime } from '@yuants/utils';
// @ts-ignore
import CryptoJS from 'crypto-js';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';
import { IGateCredential } from './types';

const BASE_URL = 'https://api.gateio.ws';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

type FlowControlConfig = { period: number; limit: number };

type QueueItem = { trace_id: string; credential?: IGateCredential; method: HttpMethod; path: string; params?: any };

type QueueResponse = { trace_id: string; response?: any; error?: Error };

type FlowController = { requestQueue: QueueItem[]; responseChannel: Subject<QueueResponse> };

const flowControllers = new Map<string, FlowController>();

const createUrl = (path: string, method: HttpMethod, params?: any) => {
  const url = new URL(BASE_URL);
  url.pathname = path;
  if (method === 'GET' && params) {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, '' + value);
    }
  }
  return url;
};

const buildHeaders = (credential: IGateCredential | undefined, method: HttpMethod, url: URL, body: string) => {
  if (!credential) {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    } as Record<string, string>;
  }
  const timestamp = Date.now() / 1000;
  const hashedBody = CryptoJS.enc.Hex.stringify(CryptoJS.SHA512(body));
  const signData = `${method}\n${url.pathname}\n${url.searchParams.toString()}\n${hashedBody}\n${timestamp}`;
  const signature = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA512(signData, credential.secret_key));
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    KEY: credential.access_key,
    SIGN: signature,
    Timestamp: `${timestamp}`,
  } as Record<string, string>;
};

const callApi = async (credential: IGateCredential | undefined, method: HttpMethod, path: string, params?: any) => {
  const url = createUrl(path, method, params);
  const body = method === 'GET' || params === undefined ? '' : JSON.stringify(params);
  const headers = buildHeaders(credential, method, url, body);
  const init: RequestInit = { method, headers, body: method === 'GET' ? undefined : body || undefined };
  console.info(formatTime(Date.now()), method, url.href, method === 'GET' ? '' : init.body || '');
  const res = await fetch(url.href, init);
  const retStr = await res.text();
  try {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(formatTime(Date.now()), 'GateResponse', path, JSON.stringify(params), retStr, res.status);
    }
    return JSON.parse(retStr);
  } catch (error) {
    console.error(formatTime(Date.now()), 'GateRequestFailed', path, JSON.stringify(params), retStr, res.status);
    throw error;
  }
};

const getFlowControllerKey = (credential: IGateCredential | undefined, path: string) =>
  `${credential ? credential.access_key : 'PUBLIC'}:${path}`;

const ensureFlowController = (key: string, config: FlowControlConfig) => {
  const existing = flowControllers.get(key);
  if (existing) return existing;
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
          const response = await callApi(request.credential, request.method, request.path, request.params);
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

const requestWithFlowControl = async (
  credential: IGateCredential | undefined,
  method: HttpMethod,
  path: string,
  config: FlowControlConfig,
  params?: any,
) => {
  const key = getFlowControllerKey(credential, path);
  const controller = ensureFlowController(key, config);
  const trace_id = UUID();
  const res$ = controller.responseChannel.pipe(
    filter((resp) => resp.trace_id === trace_id),
    mergeMap((resp) => (resp.error ? throwError(() => resp.error) : of(resp))),
    timeout(30_000),
    shareReplay(1),
  );
  controller.requestQueue.push({ trace_id, credential, method, path, params });
  return (await firstValueFrom(res$)).response;
};

export const requestPublic = <T = any>(method: HttpMethod, path: string, params?: any) =>
  callApi(undefined, method, path, params) as Promise<T>;

export const requestPrivate = <T = any>(credential: IGateCredential, method: HttpMethod, path: string, params?: any) =>
  callApi(credential, method, path, params) as Promise<T>;

export const requestPublicWithFlowControl = (method: HttpMethod, path: string, config: FlowControlConfig, params?: any) =>
  requestWithFlowControl(undefined, method, path, config, params);

export const requestPrivateWithFlowControl = (
  credential: IGateCredential,
  method: HttpMethod,
  path: string,
  config: FlowControlConfig,
  params?: any,
) => requestWithFlowControl(credential, method, path, config, params);

export const getDefaultCredential = (): IGateCredential => {
  const access_key = process.env.ACCESS_KEY;
  const secret_key = process.env.SECRET_KEY;
  if (!access_key || !secret_key) {
    throw new Error('Missing Gate credential: ACCESS_KEY and SECRET_KEY must be set');
  }
  return { access_key, secret_key };
};
