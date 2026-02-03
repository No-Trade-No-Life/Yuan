import { Terminal } from '@yuants/protocol';
import { IHTTPProxyRequest, IHTTPProxyResponse } from './types';

const proxyFetchMarker = '__isHttpServicesFetch';
const globalFetch = globalThis.fetch;
const globalScope = globalThis as typeof globalThis & { __yuantsNativeFetch?: typeof fetch };
if (!globalScope.__yuantsNativeFetch && globalFetch && !(globalFetch as any)[proxyFetchMarker]) {
  globalScope.__yuantsNativeFetch = globalFetch;
}

/**
 * 通过代理发送 HTTP 请求（fetch 兼容）
 *
 * @param input - fetch input
 * @param init - fetch init（支持 labels/timeout/terminal 注入）
 * @returns fetch Response
 *
 * @example
 * ```typescript
 * import { fetch } from '@yuants/http-services';
 *
 * const terminal = Terminal.fromNodeEnv();
 *
 * // 使用 us-west 区域的代理
 * const response = await fetch('https://api.example.com/data', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ key: 'value' }),
 *   labels: { region: 'us-west' },
 *   terminal,
 * });
 *
 * // 不指定 labels，使用任意可用代理
 * const response2 = await fetch('https://api.example.com/public', { terminal });
 *
 * if (response.ok) {
 *   const data = await response.json();
 *   console.log(data);
 * }
 * ```
 *
 * @public
 */
export interface IHTTPProxyFetchInit extends RequestInit {
  /** 标签选择器（用于路由到特定代理节点） */
  labels?: Record<string, string>;

  /** 超时时间（毫秒），默认 30000（由服务端处理） */
  timeout?: number;

  /** Terminal 注入，默认 Terminal.fromNodeEnv() */
  terminal?: Terminal;
}

/**
 * fetch 兼容的 HTTP 代理请求
 *
 * @public
 */
export const fetch = async (input: Request | string | URL, init?: IHTTPProxyFetchInit): Promise<Response> => {
  const { terminal, labels, timeout, ...requestInit } = init || {};
  const request = new Request(input, requestInit);

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: string | undefined;
  if (request.body !== null) {
    body = await request.text();
  }

  const proxyRequest: IHTTPProxyRequest = {
    url: request.url,
    method: request.method as IHTTPProxyRequest['method'],
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body,
    credentials: request.credentials as IHTTPProxyRequest['credentials'],
    redirect: request.redirect as IHTTPProxyRequest['redirect'],
    // @ts-ignore - referrerPolicy 类型兼容性
    referrerPolicy: request.referrerPolicy,
    timeout,
    labels,
  };

  // 利用 Terminal 现有的 JSON Schema 路由机制
  // 如果 request.labels 匹配某个服务的 schema，会自动路由过去
  const response = await (terminal ?? Terminal.fromNodeEnv()).client.requestForResponse<
    IHTTPProxyRequest,
    IHTTPProxyResponse
  >('HTTPProxy', proxyRequest);

  if (!response || response.code !== 0 || !response.data) {
    const code = response?.code ?? 'UNKNOWN';
    const message = response?.message ?? 'Unknown error';
    throw new Error(`HTTPProxy request failed: ${code} ${message}`);
  }

  const data = response.data;
  const fetchResponse = new Response(data.body, {
    status: data.status,
    statusText: data.statusText,
    headers: data.headers,
  });
  if (data.url) {
    Object.defineProperty(fetchResponse, 'url', {
      value: data.url,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }
  return fetchResponse;
};

(fetch as any)[proxyFetchMarker] = true;
