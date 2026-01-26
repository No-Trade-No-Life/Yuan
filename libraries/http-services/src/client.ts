import { IResponse, Terminal } from '@yuants/protocol';
import { IHTTPProxyRequest, IHTTPProxyResponse } from './types';

/**
 * 通过代理发送 HTTP 请求
 *
 * @param terminal - Terminal 实例
 * @param request - HTTP 请求参数（包含 labels 用于路由）
 * @returns HTTP 响应
 *
 * @example
 * ```typescript
 * const terminal = Terminal.fromNodeEnv();
 *
 * // 使用 us-west 区域的代理
 * const response = await requestHTTPProxy(terminal, {
 *   url: 'https://api.example.com/data',
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ key: 'value' }),
 *   labels: { region: 'us-west' }  // 自动路由到匹配的代理
 * });
 *
 * // 不指定 labels，使用任意可用代理
 * const response2 = await requestHTTPProxy(terminal, {
 *   url: 'https://api.example.com/public'
 * });
 *
 * if (response.data?.ok) {
 *   const data = JSON.parse(response.data.body);
 *   console.log(data);
 * }
 * ```
 *
 * @public
 */
export const requestHTTPProxy = async (
  terminal: Terminal,
  request: IHTTPProxyRequest,
): Promise<IResponse<IHTTPProxyResponse>> => {
  // 利用 Terminal 现有的 JSON Schema 路由机制
  // 如果 request.labels 匹配某个服务的 schema，会自动路由过去
  return terminal.client.requestForResponse<IHTTPProxyRequest, IHTTPProxyResponse>('HTTPProxy', request);
};
