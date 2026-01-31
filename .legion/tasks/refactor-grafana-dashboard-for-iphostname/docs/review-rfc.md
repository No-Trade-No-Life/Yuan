# RFC Review: Refactor Grafana Dashboard for IP/Hostname

- **Reviewer**: Antigravity (Anti-Censorship)
- **Date**: 2026-01-31
- **Target RFC**: `.legion/tasks/refactor-grafana-dashboard-for-iphostname/docs/rfc.md`
- **Verdict**: **Request Changes (必须修正)**

## 1. 核心问题：代码实现缺失 (Implementation Gap)

RFC 第 4 节假设 `http_proxy_requests_total` 等指标上存在 `ip` 和 `hostname` 标签。然而，审查 `libraries/http-services/src/server.ts` 发现当前代码**并未**将 `labels` 参数注入到 Prometheus metrics 中。

目前的 metric 记录仅包含 `method`, `status_code`, `error_code` 等固定标签。

**必须修正**:

- RFC 第 7 节（实现细节）必须包含对 `server.ts` 的修改方案。
- 必须明确说明如何将 `provideHTTPProxyService` 的 `labels` 参数映射到 Prometheus labels。

## 2. 方案审查：Server.ts 修改与基数风险 (Cardinality Risk)

针对用户提出的“将 `labels` 参数解构并注入到 metric”的方案：

**分析**:
这是实现 RFC 目标的必要手段。

**风险**:
Prometheus 的基数爆炸（High Cardinality）是常见故障源。如果调用方在 `labels` 中传入了高基数数据（如 `sessionId`, `requestId`, `timestamp`），将导致 Prometheus 内存耗尽。

**必须修正**:

- RFC 必须增加对 `labels` 内容的约束声明。
- **建议**: 在 Security Considerations 中明确规定：`labels` 参数仅允许包含低基数（Low Cardinality）的标识符（如 `region`, `az`, `cluster`, `ip`, `hostname`）。
- **可选优化**: 代码层面可以考虑引入 `metricLabelKeys` 白名单机制，防止意外注入。但考虑到奥卡姆剃刀原则，如果团队规范能保证 `labels` 仅用于服务路由（本意如此），则全量注入是可接受的最简方案。

## 3. Metric 覆盖率漏洞 (Coverage Gap)

目前的方案可能遗漏了 `activeRequests`。

- `requestsTotal`: ✅ 覆盖 (需注入)
- `requestDuration`: ✅ 覆盖 (需注入)
- `errorsTotal`: ✅ 覆盖 (需注入)
- `activeRequests`: ❌ **未覆盖**。当前 `activeRequests` 是一个无 Label 的 Gauge。

**后果**:
如果 `activeRequests` 不带 labels，运维无法通过 Dashboard 按 IP/Hostname 下钻查看“当前正在处理的请求数”。当某个特定 IP 假死或卡顿时，这个数据至关重要。

**必须修正**:

- `activeRequests` 必须改为带 label 的 Gauge。
- 在 `inc()` 和 `dec()` 时必须传入相同的 labels。

## 4. 最小化修改建议 (Minimal Changes)

建议在 `server.ts` 中执行以下修改（并在 RFC 中体现）：

```typescript
// 1. 初始化 Metric 时保留 label 定义空间（Prometheus client 通常允许动态 label，但最好明确语义）
// 注意：activeRequests 需要从无 label 改为支持 label

// 2. 注入逻辑
const metricLabels = { ...labels }; // Copy labels

// requestsTotal
requestsTotal.labels({ ...metricLabels, method, status_code: ..., error_code: ... }).inc();

// requestDuration
requestDuration.labels({ ...metricLabels, method }).observe(duration);

// errorsTotal
errorsTotal.labels({ ...metricLabels, error_type: ... }).inc();

// activeRequests
// 必须在函数作用域内持有带 label 的 partial metric，或者每次 inc/dec 都传 label
activeRequests.labels(metricLabels).inc();
// ...
activeRequests.labels(metricLabels).dec();
```

## 5. 结论

请更新 RFC 以包含上述代码层面的变更。设计收敛前不应进入 Verification 阶段。
