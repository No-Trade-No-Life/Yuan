# Observability Spec: HTTP Proxy Service Monitoring & Logging

**基于**: Dev Spec - HTTP Proxy Service Implementation  
**目标读者**: SRE、运维工程师  
**状态**: Ready for Implementation

---

## 1. 可观测性目标

### 1.1 核心指标

- **请求量（Request Volume）**: 总请求数、成功/失败率
- **延迟（Latency）**: P50, P95, P99 响应时间
- **错误率（Error Rate）**: 各类错误的分布
- **资源使用（Resource Usage）**: CPU、内存、网络

### 1.2 可观测性工具

- **Metrics**: Prometheus (已集成 @yuants/protocol)
- **Logging**: 结构化日志（JSON）
- **Tracing**: Terminal trace_id 关联

---

## 2. Metrics 设计

### 2.1 Metric 清单

利用 Terminal 已有的 metrics registry：

```typescript
// 在 provideHTTPProxyService 中添加
const metrics = terminal.metrics;

// 1. 请求计数器
const httpProxyRequestsTotal = metrics.counter('http_proxy_requests_total', 'Total HTTP proxy requests');

// 2. 请求延迟（直方图）
const httpProxyRequestDuration = metrics.histogram(
  'http_proxy_request_duration_seconds',
  'HTTP proxy request duration in seconds',
  { buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10] },
);

// 3. 活跃请求（仪表盘）
const httpProxyActiveRequests = metrics.gauge(
  'http_proxy_active_requests',
  'Number of active HTTP proxy requests',
);

// 4. 响应体大小
const httpProxyResponseSize = metrics.histogram(
  'http_proxy_response_size_bytes',
  'HTTP proxy response body size in bytes',
  { buckets: [100, 1000, 10000, 100000, 1000000] },
);
```

### 2.2 标签（Labels）

每个 metric 附加以下标签：

- `method`: HTTP 方法（GET, POST, ...）
- `status_code`: HTTP 状态码（200, 404, 500, ...）
- `terminal_id`: 代理节点 ID
- `error_code`: 错误代码（TIMEOUT, FETCH_FAILED, ...）

**示例**：

```typescript
httpProxyRequestsTotal
  .labels({
    method: req.method || 'GET',
    status_code: response.status.toString(),
    terminal_id: terminal.terminal_id,
    error_code: 'none',
  })
  .inc();
```

---

### 2.3 Metrics 埋点位置

**在 `src/server.ts` 中**：

```typescript
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  serviceOptions?: IServiceOptions
): { dispose: () => void } => {
  // 初始化 metrics
  const metrics = terminal.metrics;
  const requestsTotal = metrics.counter('http_proxy_requests_total', '...');
  const requestDuration = metrics.histogram('http_proxy_request_duration_seconds', '...', ...);
  const activeRequests = metrics.gauge('http_proxy_active_requests', '...');
  const responseSize = metrics.histogram('http_proxy_response_size_bytes', '...', ...);

  const { dispose } = terminal.server.provideService<...>(
    'HTTPProxy',
    schema,
    async (msg) => {
      const startTime = Date.now();

      // 增加活跃请求计数
      activeRequests.labels({ terminal_id: terminal.terminal_id }).inc();

      try {
        const req = msg.req;

        // ... fetch 逻辑 ...

        const response = await fetch(req.url, fetchOptions);
        const body = await response.text();

        // 记录成功 metrics
        const duration = (Date.now() - startTime) / 1000;

        requestsTotal.labels({
          method: req.method || 'GET',
          status_code: response.status.toString(),
          terminal_id: terminal.terminal_id,
          error_code: 'none'
        }).inc();

        requestDuration.labels({
          method: req.method || 'GET',
          terminal_id: terminal.terminal_id
        }).observe(duration);

        responseSize.labels({
          method: req.method || 'GET',
          terminal_id: terminal.terminal_id
        }).observe(body.length);

        return { res: { code: 0, message: 'OK', data: ... } };

      } catch (err: any) {
        // 记录错误 metrics
        const errorCode = err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED';

        requestsTotal.labels({
          method: req.method || 'GET',
          status_code: '0',
          terminal_id: terminal.terminal_id,
          error_code: errorCode
        }).inc();

        return { res: { code: errorCode, message: err.message } };

      } finally {
        // 减少活跃请求计数
        activeRequests.labels({ terminal_id: terminal.terminal_id }).dec();
      }
    },
    serviceOptions
  );

  return { dispose };
};
```

---

## 3. Logging 设计

### 3.1 日志级别

- **DEBUG**: 详细请求/响应信息
- **INFO**: 正常请求日志
- **WARN**: 可恢复的错误（如超时）
- **ERROR**: 严重错误（如 fetch 失败）

### 3.2 日志格式（JSON）

```json
{
  "timestamp": "2026-01-26T10:30:45.123Z",
  "level": "INFO",
  "service": "http-proxy",
  "terminal_id": "proxy-node-1",
  "trace_id": "abc123",
  "method": "GET",
  "url": "https://api.example.com/data",
  "status_code": 200,
  "duration_ms": 123,
  "response_size_bytes": 4567,
  "source_terminal_id": "client-node-1"
}
```

### 3.3 日志埋点

```typescript
// 在 server.ts 中
import { formatTime } from '@yuants/utils';

const log = (level: string, message: string, meta: any) => {
  if (process.env.HTTP_PROXY_LOG_LEVEL === 'DEBUG' || level !== 'DEBUG') {
    console.log(
      JSON.stringify({
        timestamp: formatTime(Date.now()),
        level,
        service: 'http-proxy',
        terminal_id: terminal.terminal_id,
        message,
        ...meta,
      }),
    );
  }
};

// 使用示例
log('INFO', 'HTTP request completed', {
  trace_id: msg.trace_id,
  method: req.method,
  url: req.url,
  status_code: response.status,
  duration_ms: Date.now() - startTime,
  response_size_bytes: body.length,
  source_terminal_id: msg.source_terminal_id,
});
```

---

## 4. Tracing 设计

### 4.1 Trace ID 传播

利用 Terminal 的 `trace_id` 机制：

- Client 发起请求时，Terminal 自动生成 `trace_id`
- Proxy 节点记录该 `trace_id` 到日志和 metrics
- 可在 Prometheus 和日志中按 `trace_id` 查询完整链路

### 4.2 Trace Context

在日志中记录完整上下文：

```json
{
  "trace_id": "abc123",
  "source_terminal_id": "client-node-1",
  "target_terminal_id": "proxy-node-1",
  "http_url": "https://api.example.com/data",
  "http_method": "GET",
  "http_status": 200,
  "duration_ms": 123
}
```

---

## 5. Dashboard 设计

### 5.1 Grafana Dashboard

**面板清单**：

1. **请求吞吐量**：

   - Metric: `rate(http_proxy_requests_total[1m])`
   - 按 `status_code` 分组

2. **请求延迟**：

   - Metric: `histogram_quantile(0.95, http_proxy_request_duration_seconds)`
   - P50, P95, P99 曲线

3. **错误率**：

   - Metric: `rate(http_proxy_requests_total{error_code!="none"}[1m])`
   - 按 `error_code` 分组

4. **活跃请求**：

   - Metric: `http_proxy_active_requests`

5. **响应体大小分布**：
   - Metric: `histogram_quantile(0.95, http_proxy_response_size_bytes)`

### 5.2 告警规则

**Prometheus AlertManager 规则**：

```yaml
groups:
  - name: http-proxy
    rules:
      # 高错误率告警
      - alert: HTTPProxyHighErrorRate
        expr: |
          rate(http_proxy_requests_total{error_code!="none"}[5m])
          /
          rate(http_proxy_requests_total[5m])
          \u003e 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'HTTP Proxy 错误率超过 10%'

      # 高延迟告警
      - alert: HTTPProxyHighLatency
        expr: |
          histogram_quantile(0.95,
            rate(http_proxy_request_duration_seconds_bucket[5m])
          ) \u003e 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'HTTP Proxy P95 延迟超过 2 秒'

      # 服务不可用告警
      - alert: HTTPProxyServiceDown
        expr: |
          up{job="http-proxy"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'HTTP Proxy 服务下线'
```

---

## 6. 实现示例

### 6.1 完整的 Metrics + Logging 集成

```typescript
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  serviceOptions?: IServiceOptions
): { dispose: () => void } => {
  // Metrics
  const metrics = terminal.metrics;
  const requestsTotal = metrics.counter(
    'http_proxy_requests_total',
    'Total HTTP proxy requests'
  );
  const requestDuration = metrics.histogram(
    'http_proxy_request_duration_seconds',
    'HTTP proxy request duration',
    { buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10] }
  );
  const activeRequests = metrics.gauge(
    'http_proxy_active_requests',
    'Active HTTP proxy requests'
  );
  const responseSize = metrics.histogram(
    'http_proxy_response_size_bytes',
    'Response size',
    { buckets: [100, 1000, 10000, 100000, 1000000] }
  );

  // Logging
  const log = (level: string, message: string, meta: any = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'http-proxy',
      terminal_id: terminal.terminal_id,
      message,
      ...meta
    }));
  };

  // Service Handler
  const { dispose } = terminal.server.provideService<...>(
    'HTTPProxy',
    schema,
    async (msg) => {
      const startTime = Date.now();
      const req = msg.req;

      // 增加活跃请求
      activeRequests.labels({ terminal_id: terminal.terminal_id }).inc();

      log('INFO', 'HTTP proxy request started', {
        trace_id: msg.trace_id,
        method: req.method,
        url: req.url,
        source_terminal_id: msg.source_terminal_id
      });

      try {
        // ... fetch 逻辑 ...

        const duration = (Date.now() - startTime) / 1000;

        // 记录 metrics
        requestsTotal.labels({
          method: req.method || 'GET',
          status_code: response.status.toString(),
          terminal_id: terminal.terminal_id,
          error_code: 'none'
        }).inc();

        requestDuration.labels({
          method: req.method || 'GET',
          terminal_id: terminal.terminal_id
        }).observe(duration);

        responseSize.labels({
          method: req.method || 'GET',
          terminal_id: terminal.terminal_id
        }).observe(body.length);

        log('INFO', 'HTTP proxy request completed', {
          trace_id: msg.trace_id,
          method: req.method,
          url: req.url,
          status_code: response.status,
          duration_ms: duration * 1000,
          response_size_bytes: body.length
        });

        return { res: { code: 0, message: 'OK', data: proxyResponse } };

      } catch (err: any) {
        const errorCode = err.name === 'AbortError' ? 'TIMEOUT' : 'FETCH_FAILED';

        requestsTotal.labels({
          method: req.method || 'GET',
          status_code: '0',
          terminal_id: terminal.terminal_id,
          error_code: errorCode
        }).inc();

        log('ERROR', 'HTTP proxy request failed', {
          trace_id: msg.trace_id,
          method: req.method,
          url: req.url,
          error_code: errorCode,
          error_message: err.message
        });

        return { res: { code: errorCode, message: err.message } };

      } finally {
        activeRequests.labels({ terminal_id: terminal.terminal_id }).dec();
      }
    },
    serviceOptions
  );

  return { dispose };
};
```

---

## 7. 运维检查清单

### 7.1 部署前检查

- [ ] Prometheus 正确抓取 metrics（`:9090/targets`）
- [ ] Grafana Dashboard 导入成功
- [ ] AlertManager 规则配置正确
- [ ] 日志输出到正确的位置（stdout/file）

### 7.2 运行时监控

- [ ] 定期查看 Dashboard（错误率、延迟）
- [ ] 查看告警（是否触发）
- [ ] 检查日志（ERROR 级别）
- [ ] 资源使用（CPU、内存）

---

## 8. 验收标准

- [ ] 所有 metrics 正确上报到 Prometheus
- [ ] Grafana Dashboard 显示实时数据
- [ ] 日志格式符合 JSON 规范
- [ ] 告警规则能正确触发
- [ ] Trace ID 可追踪完整请求链路

---

**下一步**：

- 实现 metrics 和 logging 埋点
- 创建 Grafana Dashboard JSON
- 配置 Prometheus AlertManager 规则
- 编写运维文档
