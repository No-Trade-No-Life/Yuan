# RFC: HTTP Proxy Service Metrics 打点方案与 Grafana Dashboard 设计

**RFC ID**: http-proxy-metrics-001
**状态**: Draft
**创建日期**: 2026-01-30
**目标读者**: SRE、运维工程师、后端开发

---

## 摘要

本文档定义 `http-proxy-service` 的 Prometheus metrics 规范和 Grafana Dashboard 模板，实现对每个 HTTP Proxy Terminal 的可观测性覆盖。当前 `provideHTTPProxyService` 函数已实现完整的 HTTP 代理逻辑，但仅有 `console.warn` 日志，缺乏结构化的 metrics 打点。本方案利用 `Terminal.metrics` registry，设计 5 个核心指标（Counter x2, Histogram x2, Gauge x1），支持按 method、status_code、error_code、terminal_labels 分维度的细粒度监控。

**核心变更**：

- 在 `server.ts` 中添加 5 个 metrics 的初始化和采集逻辑
- 支持从 `terminal.terminalInfo.tags` 提取 region、tier、ip 等标签
- 提供 Grafana Dashboard JSON 模板，包含全局概览、延迟分布、Terminal 分组、错误分析四个 Row

---

## 1. 背景与动机

### 1.1 当前问题

`libraries/http-services/src/server.ts` 中的 `provideHTTPProxyService` 函数目前存在以下可观测性缺口：

1. **无结构化 metrics**：仅有 `console.warn` 输出错误信息，无法被 Prometheus 抓取
2. **无法按维度聚合**：无法按 Terminal、method、status_code 统计请求分布
3. **缺乏延迟可见性**：无法监控 P50/P95/P99 延迟分布
4. **错误分类缺失**：无法区分 TIMEOUT、FETCH_FAILED 等不同错误类型
5. **Dashboard 空缺**：没有可用的 Grafana 监控面板

### 1.2 业务价值

- **SRE**：通过错误率和延迟告警及时发现服务异常
- **运维**：按 Terminal 分组监控资源使用和性能表现
- **开发**：通过错误分类快速定位问题根因
- **业务方**：了解 API 调用的成功率和性能 SLA

---

## 2. 目标与非目标

### 2.1 目标 (Goals)

1. **R1**：所有 HTTP Proxy 请求必须被 metrics 覆盖，零遗漏
2. **R2**：支持按 method、status_code、error_code、terminal_labels 分维度聚合
3. **R3**：提供 P50/P95/P99 延迟分布的 Histogram 数据
4. **R4**：提供 Grafana Dashboard 模板，开箱即用
5. **R5**：每个 MUST 行为必须可映射到测试断言

### 2.2 非目标 (Non-Goals)

1. **N1**：不修改 `IHTTPProxyRequest` / `IHTTPProxyResponse` 类型定义
2. **N2**：不引入新的日志格式（沿用现有 `console.warn` 兼容）
3. **N3**：不实现 AlertManager 告警规则（但提供 Prometheus Query 示例）
4. **N4**：不处理 Tracing（依赖 Terminal 已有的 trace_id 机制）

---

## 3. 定义与术语

| 术语            | 定义                                                           |
| --------------- | -------------------------------------------------------------- |
| **Terminal**    | @yuants/protocol 中的节点抽象，包含 metrics registry           |
| **Cardinality** | Label 组合的基数，高基数会导致 Prometheus 性能问题             |
| **Bucket**      | Histogram 的时间/大小分桶，用于计算百分位                      |
| **Rate**        | 计数器随时间的变化率，如 `rate(http_proxy_requests_total[1m])` |

---

## 4. Metrics 规范

### 4.1 指标定义表

| 指标名称                              | 类型      | Labels                                | 说明         | 采集语义                 |
| ------------------------------------- | --------- | ------------------------------------- | ------------ | ------------------------ |
| `http_proxy_requests_total`           | Counter   | `method`, `status_code`, `error_code` | 请求总数     | 每次请求结束时递增       |
| `http_proxy_request_duration_seconds` | Histogram | `method`                              | 请求延迟分布 | 每次请求结束时观察       |
| `http_proxy_active_requests`          | Gauge     | -                                     | 活跃请求数   | 请求开始时 +1，结束时 -1 |
| `http_proxy_errors_total`             | Counter   | `error_type`                          | 错误分类统计 | 捕获异常时递增           |

### 4.2 详细规格

#### 4.2.1 `http_proxy_requests_total`

```typescript
// Counter 定义
const requestsTotal = metrics.counter('http_proxy_requests_total', 'Total HTTP proxy requests', {
  labels: ['method', 'status_code', 'error_code'] as const,
});
```

**Labels**：

- `method`: HTTP 方法，取值范围 `{GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS}`
- `status_code`: HTTP 状态码，字符串形式 `{200, 404, 500, ...}`，错误时为 `0`
- `error_code`: 错误码，`none` 表示无错误，其他取值见 4.4

**R6**：`requestsTotal.labels({method, status_code, error_code}).inc()` 必须在请求处理完成后（包括错误）被调用。

#### 4.2.2 `http_proxy_request_duration_seconds`

```typescript
// Histogram 定义
const requestDuration = metrics.histogram(
  'http_proxy_request_duration_seconds',
  'HTTP proxy request duration in seconds',
  {
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  },
);
```

**Labels**：

- `method`: HTTP 方法

**Bucket 设计依据**：

- 下界 0.01s (10ms)：HTTP 代理通常延迟在 10ms+ 级别
- 上界 30s：覆盖完整超时范围（默认超时 30s）
- 关键阈值：0.1s (100ms)、0.5s、1s、5s 用于 SLA 分层

**R7**：`requestDuration.labels({method}).observe(duration)` 必须在请求处理完成后调用，`duration` 单位为秒。

#### 4.2.3 `http_proxy_active_requests`

```typescript
// Gauge 定义
const activeRequests = metrics.gauge('http_proxy_active_requests', 'Number of active HTTP proxy requests');
```

**Labels**：无（全局单一值）

**R8**：请求开始时调用 `activeRequests.inc()`，请求结束时调用 `activeRequests.dec()`。

#### 4.2.4 `http_proxy_errors_total`

```typescript
// Counter 定义
const errorsTotal = metrics.counter('http_proxy_errors_total', 'Total HTTP proxy errors by type', {
  labels: ['error_type'] as const,
});
```

**Labels**：

- `error_type`: 错误类型，取值见 4.4

**R9**：`errorsTotal.labels({error_type}).inc()` 必须在捕获异常时调用。

**说明**：移除 `reason` Label 避免高基数风险。调试信息依赖日志而非 metrics。

### 4.3 Terminal Labels 提取

```typescript
// 从 terminal.terminalInfo.tags 提取可选标签
const terminalLabels = {
  region: terminal.terminalInfo.tags?.region,
  tier: terminal.terminalInfo.tags?.tier,
  ip: terminal.terminalInfo.tags?.ip,
};
```

**R11**：Terminal labels 必须是可选的（存在则添加，不存在则省略）。

**R12**：禁止将 URL 路径、query 参数等高基数字段作为 Label。

### 4.4 错误码定义

| error_code           | error_type | 触发条件                       |
| -------------------- | ---------- | ------------------------------ |
| `none`               | -          | 正常请求完成                   |
| `TIMEOUT`            | timeout    | 请求超时（AbortError）         |
| `FORBIDDEN`          | security   | 主机不在 allowedHosts 白名单   |
| `FETCH_FAILED`       | network    | fetch 抛出非 AbortError 异常   |
| `INVALID_URL`        | validation | URL 格式解析失败               |
| `RESPONSE_TOO_LARGE` | security   | 响应体超过 maxResponseBodySize |

---

## 5. 采集点设计

### 5.1 端到端流程

```
请求进入
    │
    ▼
┌─────────────────────┐
│ 5.1.1 active_requests.inc()  │ ← R8
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5.1.2 验证 URL 合法性 │
└─────────────────────┘
    │ 异常 → INVALID_URL
    ▼
┌─────────────────────┐
│ 5.1.3 验证 allowedHosts │
└─────────────────────┘
    │ 异常 → FORBIDDEN
    ▼
┌─────────────────────┐
│ 5.1.4 执行 fetch 请求 │
└─────────────────────┘
    │ 异常 → TIMEOUT / FETCH_FAILED
    ▼
┌─────────────────────┐
│ 5.1.5 检查响应体大小  │
└─────────────────────┘
    │ 异常 → RESPONSE_TOO_LARGE
    ▼
┌─────────────────────┐
│ 5.1.6 读取响应体     │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5.1.7 记录 metrics   │ ← R6, R7, R9
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5.1.8 active_requests.dec()  │ ← R8
└─────────────────────┘
```

### 5.2 伪代码实现

```typescript
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  options?: IServiceOptions & IHTTPProxyOptions,
): { dispose: () => void } => {
  const { allowedHosts, maxResponseBodySize = 10 * 1024 * 1024, ...serviceOptions } = options || {};

  // 5.2.1 初始化 metrics（服务级别，一次性）
  const metrics = terminal.metrics;
  const requestsTotal = metrics.counter('http_proxy_requests_total', 'Total HTTP proxy requests', {
    labels: ['method', 'status_code', 'error_code'] as const,
  });
  const requestDuration = metrics.histogram(
    'http_proxy_request_duration_seconds',
    'HTTP proxy request duration in seconds',
    { buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] },
  );
  const activeRequests = metrics.gauge('http_proxy_active_requests', 'Number of active HTTP proxy requests');
  const errorsTotal = metrics.counter('http_proxy_errors_total', 'Total HTTP proxy errors by type', {
    labels: ['error_type'] as const,
  });

  // 5.2.2 提取 terminal labels
  const terminalTags = terminal.terminalInfo.tags || {};
  const region = terminalTags.region;
  const tier = terminalTags.tier;
  const ip = terminalTags.ip;

  // 5.2.3 注册服务处理器
  const { dispose } = terminal.server.provideService<IHTTPProxyRequest, IHTTPProxyResponse>(
    'HTTPProxy',
    schema,
    async (msg) => {
      const req = msg.req;
      const startTime = Date.now();
      let statusCode = 0;
      let errorCode = 'none';
      let responseBytes = 0;

      // 5.2.4 R8: 请求开始，递增活跃请求
      activeRequests.inc();

      try {
        // 5.2.5 验证 URL 合法性
        const urlObj = scopeError('INVALID_URL', { url: req.url }, () => new URL(req.url));

        // 5.2.6 验证 allowedHosts
        if (allowedHosts && allowedHosts.length > 0) {
          if (!allowedHosts.includes(urlObj.hostname)) {
            // R9: 记录 FORBIDDEN 错误
            errorsTotal.labels({ error_type: 'security' }).inc();
            throw newError('FORBIDDEN', { host: urlObj.hostname, allowedHosts });
          }
        }

        // 5.2.7 执行 fetch
        const timeoutMs = req.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(req.url, { ...fetchOptions, signal: controller.signal });
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

        // 5.2.8 检查 Content-Length
        const contentLengthHeader = response.headers.get('content-length');
        if (contentLengthHeader) {
          const contentLength = parseInt(contentLengthHeader, 10);
          if (!isNaN(contentLength) && contentLength > maxResponseBodySize) {
            // R9: 记录 RESPONSE_TOO_LARGE 错误
            errorsTotal.labels({ error_type: 'security' }).inc();
            throw newError('RESPONSE_TOO_LARGE', { url: req.url, contentLength, maxResponseBodySize });
          }
        }

        // 5.2.9 读取响应体
        // ... 流式读取逻辑 ...
        const result = new Uint8Array(receivedLength);
        // ... 合并 chunk ...

        responseBytes = receivedLength;
        statusCode = response.status;

        // 5.2.10 成功响应记录 metrics
        const duration = (Date.now() - startTime) / 1000;

        // R6: 记录请求总数
        requestsTotal
          .labels({
            method: req.method || 'GET',
            status_code: statusCode.toString(),
            error_code: 'none',
          })
          .inc();

        // R7: 记录延迟分布
        requestDuration.labels({ method: req.method || 'GET' }).observe(duration);

        return {
          /* ... */
        };
      } catch (err: any) {
        // 5.2.11 错误响应记录 metrics
        errorCode = err.code || 'FETCH_FAILED';
        statusCode = 0;

        // R6: 记录请求总数（错误情况）
        requestsTotal
          .labels({
            method: req.method || 'GET',
            status_code: '0',
            error_code: errorCode,
          })
          .inc();

        // R7: 记录延迟分布（错误情况也记录）
        const duration = (Date.now() - startTime) / 1000;
        requestDuration.labels({ method: req.method || 'GET' }).observe(duration);

        throw err;
      } finally {
        // 5.2.12 R8: 请求结束，递减活跃请求
        activeRequests.dec();
      }
    },
    serviceOptions,
  );

  return { dispose };
};
```

---

## 6. Grafana Dashboard 设计

### 6.1 Dashboard 概览

```json
{
  "title": "HTTP Proxy Service Monitor",
  "tags": ["http-proxy", "proxy"],
  "timezone": "browser",
  "refresh": "10s",
  "panels": [
    // Row 1: 全局概览
    // Row 2: 延迟分布
    // Row 3: 按 Terminal 分组
    // Row 4: 错误分析
  ],
  "templating": {
    "list": [
      {
        "name": "region",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(http_proxy_requests_total, region)"
      },
      {
        "name": "tier",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(http_proxy_requests_total, tier)"
      }
    ]
  }
}
```

### 6.2 面板定义

精简至 **7 个核心面板**，每个面板对应明确用户故事：

#### 6.2.1 全局概览 Row

| 面板名称       | 类型        | Query                                                                                                           | 用户故事       |
| -------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | -------------- |
| Total Requests | Stat        | `sum(increase(http_proxy_requests_total[$__range]))`                                                            | 了解服务总流量 |
| Success Rate   | Gauge       | `sum(rate(http_proxy_requests_total{status_code=~"2.."}[1m])) / sum(rate(http_proxy_requests_total[1m])) * 100` | 监控服务健康度 |
| P99 Latency    | Time series | `histogram_quantile(0.99, rate(http_proxy_request_duration_seconds_bucket[5m]))`                                | 识别长尾延迟   |

#### 6.2.2 延迟分布 Row

| 面板名称             | 类型        | Query                                                                            | 用户故事         |
| -------------------- | ----------- | -------------------------------------------------------------------------------- | ---------------- |
| P95 Latency          | Time series | `histogram_quantile(0.95, rate(http_proxy_request_duration_seconds_bucket[5m]))` | SLA 合规监控     |
| Latency Distribution | Bar gauge   | `sum(rate(http_proxy_request_duration_seconds_bucket[5m])) by (le)`              | 快速识别延迟分布 |

#### 6.2.3 按 Terminal 分组 Row

| 面板名称               | 类型  | Query                                                                                                                               | 用户故事       |
| ---------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Requests by Region     | Table | `sum by (region) (rate(http_proxy_requests_total[5m]))`                                                                             | 流量来源分布   |
| Success Rate by Region | Table | `sum by (region) (rate(http_proxy_requests_total{status_code=~"2.."}[5m])) / sum by (region) (rate(http_proxy_requests_total[5m]))` | 区域健康度对比 |

#### 6.2.4 错误分析 Row

| 面板名称       | 类型      | Query                                                     | 用户故事     |
| -------------- | --------- | --------------------------------------------------------- | ------------ |
| Errors by Type | Pie chart | `sum by (error_type) (rate(http_proxy_errors_total[5m]))` | 错误分类占比 |

---

## 7. 安全性考虑

### 7.1 Label Cardinality 控制

**R13**：禁止将用户可控的输入（如 URL 路径、query 参数、User-Agent）作为 Label 值。

**R14**：`error_code` Label 必须使用预定义枚举值，禁止动态拼接。

### 7.2 资源耗尽防护

**R15**：`activeRequests` Gauge 必须有合理的上限监控，异常增长时触发告警。

**R16**：Bucket 配置必须覆盖实际业务范围，避免 bucket 溢出导致精度丢失。

### 7.3 输入校验

**R17**：所有外部输入（req.url、req.method）必须经过验证后再用于 Label 值。

---

## 8. 向后兼容与迁移

### 8.1 兼容性策略

- **添加而非修改**：新 metrics 为新增字段，不影响现有功能
- **默认值兼容**：`status_code` 错误时默认为 `"0"`，兼容现有查询

### 8.2 灰度发布

1. **阶段 1**：在开发环境部署，验证 metrics 采集正确性
2. **阶段 2**：在 staging 环境部署，验证 Grafana Dashboard 数据完整性
3. **阶段 3**：生产环境逐步切换（5% → 50% → 100%）

### 8.3 回滚方案

- 代码回滚：git revert 到上一版本
- metrics 保留：旧版本停止后，已采集的历史数据保留 90 天

---

## 9. 可测试性

### 9.1 测试映射表

| 行为                     | 测试用例           | 断言                                                                    |
| ------------------------ | ------------------ | ----------------------------------------------------------------------- |
| R6: requests_total 递增  | 正常请求、错误请求 | `expect(requestsTotal.labels(...).inc).toHaveBeenCalled()`              |
| R7: duration 观察        | GET/POST 请求      | `expect(requestDuration.labels(...).observe).toHaveBeenCalledWith(>=0)` |
| R8: active_requests 增减 | 并发请求           | `expect(activeRequests.inc).toHaveBeenCalled()` + `dec`                 |
| R9: errors_total 递增    | 各错误类型         | `expect(errorsTotal.labels(...).inc).toHaveBeenCalled()`                |

---

## 10. 开放问题

| ID  | 问题                                              | 优先级 | 负责人                                 |
| --- | ------------------------------------------------- | ------ | -------------------------------------- |
| Q1  | 是否需要按 URL 主机名（hostname）聚合请求量？     | 高     | **暂缓**：待真实流量分析后再决定       |
| Q2  | Dashboard 是否需要按小时/天聚合视图？             | 中     | 可通过时间范围选择器实现               |
| Q3  | 是否需要提供预置的 Prometheus AlertManager 规则？ | 低     | 作为独立 YAML 文件提供（不在本次范围） |

---

## 11. 实施计划

### 11.1 文件变更清单

| 文件                                                   | 变更类型 | 说明                          |
| ------------------------------------------------------ | -------- | ----------------------------- |
| `libraries/http-services/src/server.ts`                | 修改     | 添加 metrics 初始化和采集逻辑 |
| `libraries/http-services/src/__tests__/server.test.ts` | 修改     | 添加 metrics 测试用例         |
| `libraries/http-services/grafana-dashboard.json`       | 新增     | Grafana Dashboard 模板        |

### 11.2 实施步骤

1. **步骤 1**：在 `server.ts` 中添加 metrics 初始化代码
2. **步骤 2**：在请求处理 handler 中添加 metrics 采集点
3. **步骤 3**：编写单元测试验证 metrics 行为
4. **步骤 4**：创建 Grafana Dashboard JSON 模板
5. **步骤 5**：本地验证 metrics 采集和 Dashboard 显示
6. **步骤 6**：提交代码 Review

### 11.3 验证策略

- **单元测试**：`npm run test` 通过所有 metrics 相关测试
- **集成测试**：本地启动 Terminal，验证 metrics endpoint 输出
- **Dashboard 验证**：导入 JSON 模板，确认各面板有数据

---

## 参考资料

- [spec-obs.md](../http-proxy-service/docs/spec-obs.md) - 原有的可观测性设计
- [@yuants/protocol](https://www.yuants.dev/api/modules/_yuants_protocol.html) - Terminal.metrics API
- [Prometheus Histogram](https://prometheus.io/docs/concepts/metric_types/#histogram) - 直方图类型说明
- [Grafana Heatmap](https://grafana.com/docs/grafana/latest/visualizations/heatmap/) - 热力图面板

---

**本文档为设计真源，所有实现必须以此为准。**
