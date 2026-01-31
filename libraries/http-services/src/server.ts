import { IServiceOptions, Terminal } from '@yuants/protocol';
import { newError, scopeError } from '@yuants/utils';
import { IHTTPProxyRequest, IHTTPProxyResponse, IHTTPProxyOptions } from './types';

/**
 * 提供 HTTP 代理服务
 *
 * @param terminal - Terminal 实例
 * @param labels - 服务标签（用于客户端路由选择）
 * @param options - 服务选项（包含 allowedHosts, maxResponseBodySize 和 IServiceOptions）
 * @returns dispose 函数
 *
 * @example
 * ```typescript
 * const terminal = Terminal.fromNodeEnv();
 *
 * // 注册一个 us-west 区域的代理
 * provideHTTPProxyService(terminal, {
 *   region: 'us-west',
 *   tier: 'premium',
 *   ip: '192.168.1.100'
 * }, {
 *   concurrent: 10,
 *   max_pending_requests: 100,
 *   allowedHosts: ['api.example.com', 'api.google.com'],
 *   maxResponseBodySize: 10 * 1024 * 1024 // 10MB
 * });
 *
 * // 注册一个 eu-central 区域的代理
 * provideHTTPProxyService(terminal, {
 *   region: 'eu-central',
 *   tier: 'standard'
 * });
 * ```
 *
 * @public
 */
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  options?: IServiceOptions & IHTTPProxyOptions,
): { dispose: () => void } => {
  const { allowedHosts, maxResponseBodySize = 10 * 1024 * 1024, ...serviceOptions } = options || {};

  // Inject labels into terminal tags
  if (!terminal.terminalInfo.tags) {
    terminal.terminalInfo.tags = {};
  }
  Object.assign(terminal.terminalInfo.tags, labels);

  // Initialize metrics
  const metrics = terminal.metrics;
  const requestsTotal = metrics.counter('http_proxy_requests_total', 'Total HTTP proxy requests');
  const requestDuration = metrics.histogram(
    'http_proxy_request_duration_seconds',
    'HTTP proxy request duration in seconds',
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  );
  const activeRequests = metrics.gauge('http_proxy_active_requests', 'Number of active HTTP proxy requests');
  const errorsTotal = metrics.counter('http_proxy_errors_total', 'Total HTTP proxy errors by type');

  // 1. 构造包含 labels 约束的 JSON Schema（支持部分匹配）
  const labelProperties: Record<string, { const: string }> = {};
  for (const [key, value] of Object.entries(labels)) {
    labelProperties[key] = { const: value };
  }

  const schema = {
    type: 'object' as const,
    required: ['url'],
    properties: {
      url: { type: 'string' as const, format: 'uri' },
      method: {
        type: 'string' as const,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      },
      headers: {
        type: 'object' as const,
        additionalProperties: { type: 'string' as const },
      },
      body: { type: 'string' as const },
      credentials: {
        type: 'string' as const,
        enum: ['omit', 'same-origin', 'include'],
      },
      redirect: {
        type: 'string' as const,
        enum: ['follow', 'error', 'manual'],
      },
      referrerPolicy: { type: 'string' as const },
      timeout: { type: 'number' as const, minimum: 0 },
      // labels 约束：只验证提供的 labels 值是否匹配（支持部分匹配）
      labels: {
        type: 'object' as const,
        properties: labelProperties,
      },
    },
  };

  // 2. 注册服务处理器
  const { dispose } = terminal.server.provideService<IHTTPProxyRequest, IHTTPProxyResponse>(
    'HTTPProxy',
    schema,
    async (msg) => {
      const req = msg.req;
      const startTime = Date.now();
      let statusCode = 0;
      let errorCode = 'none';
      const method = req.method || 'GET';

      // R8: 请求开始，递增活跃请求
      activeRequests.inc();

      try {
        // Security Check: SSRF
        // 验证 URL 合法性并检查 allowedHosts
        const urlObj = scopeError('INVALID_URL', { url: req.url }, () => new URL(req.url));

        if (allowedHosts && allowedHosts.length > 0) {
          if (!allowedHosts.includes(urlObj.hostname)) {
            // R9: 记录 FORBIDDEN 错误
            errorsTotal.labels({ error_type: 'security' }).inc();
            console.warn(`[HTTPProxy] Blocked access to ${urlObj.hostname} (not in allowedHosts)`);
            throw newError('FORBIDDEN', { host: urlObj.hostname, allowedHosts });
          }
        }

        // 3. 构造 fetch 参数
        const fetchOptions: RequestInit = {
          method: req.method || 'GET',
          headers: req.headers,
          body: req.body,
          credentials: req.credentials,
          redirect: req.redirect,
          // @ts-ignore - referrerPolicy 类型兼容性
          referrerPolicy: req.referrerPolicy,
        };

        // 4. 执行 fetch（带超时）
        const timeoutMs = req.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(req.url, {
            ...fetchOptions,
            signal: controller.signal,
          });
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            // R9: 记录 TIMEOUT 错误
            errorsTotal.labels({ error_type: 'timeout' }).inc();
            throw newError('TIMEOUT', { url: req.url, timeoutMs }, err);
          }
          // R9: 记录 FETCH_FAILED 错误
          errorsTotal.labels({ error_type: 'network' }).inc();
          throw newError('FETCH_FAILED', { url: req.url }, err);
        } finally {
          clearTimeout(timeoutId);
        }

        // Security Check: DoS (Content-Length)
        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
          const contentLength = parseInt(contentLengthHeader, 10);
          if (!isNaN(contentLength) && contentLength > maxResponseBodySize) {
            // R9: 记录 RESPONSE_TOO_LARGE 错误
            errorsTotal.labels({ error_type: 'security' }).inc();
            throw newError('RESPONSE_TOO_LARGE', { url: req.url, contentLength, maxResponseBodySize });
          }
        }

        // 5. 提取响应信息 (Safe Read)
        // 使用流式读取以防止大文件导致 OOM
        let body = '';
        if (response.body) {
          const reader = response.body.getReader();
          let receivedLength = 0;
          const chunks: Uint8Array[] = [];

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              if (value) {
                receivedLength += value.length;
                if (receivedLength > maxResponseBodySize) {
                  await reader.cancel('Response size limit exceeded');
                  // R9: 记录 RESPONSE_TOO_LARGE 错误
                  errorsTotal.labels({ error_type: 'security' }).inc();
                  throw newError('RESPONSE_TOO_LARGE', { url: req.url, maxResponseBodySize });
                }
                chunks.push(value);
              }
            }
          } finally {
            reader.releaseLock();
          }

          const result = new Uint8Array(receivedLength);
          let offset = 0;
          for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
          }
          body = new TextDecoder().decode(result);
        } else {
          const buffer = await scopeError(
            'READ_BODY_FAILED',
            { url: req.url, maxResponseBodySize },
            async () => response.arrayBuffer(),
          );
          if (buffer.byteLength > maxResponseBodySize) {
            // R9: 记录 RESPONSE_TOO_LARGE 错误
            errorsTotal.labels({ error_type: 'security' }).inc();
            throw newError('RESPONSE_TOO_LARGE', {
              url: req.url,
              maxResponseBodySize,
              size: buffer.byteLength,
            });
          }
          body = new TextDecoder().decode(buffer);
        }

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        statusCode = response.status;

        // R6: 记录请求总数（成功情况）
        requestsTotal
          .labels({
            method,
            status_code: statusCode.toString(),
            error_code: 'none',
          })
          .inc();

        const proxyResponse: IHTTPProxyResponse = {
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
          ok: response.ok,
          url: response.url,
        };

        return {
          res: {
            code: 0,
            message: 'OK',
            data: proxyResponse,
          },
        };
      } catch (err: any) {
        // 错误响应记录 metrics
        // 从错误消息中提取 error_code（格式为 "TYPE: context"）
        errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
        statusCode = 0;

        // R9: 根据错误类型记录 errors_total
        const errorTypeMap: Record<string, string> = {
          TIMEOUT: 'timeout',
          FORBIDDEN: 'security',
          FETCH_FAILED: 'network',
          INVALID_URL: 'validation',
          RESPONSE_TOO_LARGE: 'security',
        };
        errorsTotal.labels({ error_type: errorTypeMap[errorCode] || 'unknown' }).inc();

        // R6: 记录请求总数（错误情况）
        requestsTotal
          .labels({
            method,
            status_code: '0',
            error_code: errorCode,
          })
          .inc();

        throw err;
      } finally {
        // R7: 记录延迟分布
        const duration = (Date.now() - startTime) / 1000;
        requestDuration.labels({ method }).observe(duration);

        // R8: 请求结束，递减活跃请求
        activeRequests.dec();
      }
    },
    serviceOptions,
  );

  return { dispose };
};
