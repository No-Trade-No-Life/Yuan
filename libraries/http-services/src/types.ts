/**
 * HTTP Proxy Service Types
 * @packageDocumentation
 */

/**
 * HTTP 代理请求参数
 * @public
 */
export interface IHTTPProxyRequest {
  /** 请求 URL */
  url: string;

  /** HTTP 方法，默认 GET */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

  /** 请求头 */
  headers?: Record<string, string>;

  /** 请求体（字符串，JSON 序列化后） */
  body?: string;

  /** 凭证模式 */
  credentials?: 'omit' | 'same-origin' | 'include';

  /** 重定向模式 */
  redirect?: 'follow' | 'error' | 'manual';

  /** 引用策略 */
  referrerPolicy?: string;

  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;

  /**
   * 标签选择器（用于路由到特定代理节点）
   *
   * @example
   * ```typescript
   * // 只路由到 us-west 区域的代理
   * { labels: { region: 'us-west' } }
   *
   * // 只路由到高带宽节点
   * { labels: { capability: 'high-bandwidth' } }
   *
   * // 同时满足多个条件
   * { labels: { region: 'us-west', tier: 'premium' } }
   * ```
   */
  labels?: Record<string, string>;
}

/**
 * HTTP 代理服务配置选项
 * @public
 */
export interface IHTTPProxyOptions {
  /**
   * 允许访问的主机列表（白名单）
   * - 如果未提供或为空，则允许访问所有主机（不安全，建议配置）
   * - 支持域名（如 "api.example.com"）
   * - 不支持通配符
   */
  allowedHosts?: string[];

  /**
   * 最大响应体大小（字节）
   * - 默认 10MB (10 * 1024 * 1024)
   * - 如果响应体超过此大小，将抛出错误
   */
  maxResponseBodySize?: number;
}

/**
 * HTTP 代理响应
 * @public
 */
export interface IHTTPProxyResponse {
  /** HTTP 状态码 */
  status: number;

  /** HTTP 状态文本 */
  statusText: string;

  /** 响应头（扁平化为 Record） */
  headers: Record<string, string>;

  /** 响应体（字符串） */
  body: string;

  /** 请求是否成功（status 2xx） */
  ok: boolean;

  /** 最终 URL（可能因重定向而改变） */
  url: string;
}
