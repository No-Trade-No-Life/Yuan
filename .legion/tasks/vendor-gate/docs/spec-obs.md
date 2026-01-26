# Spec: vendor-gate 理财账户实现（Observability）

## 概述

本文档描述 vendor-gate 理财账户服务的可观测性需求，包括日志、指标、告警和链路追踪。

## 监控维度

### 1. 可用性 (Availability)

- 服务是否正常注册和响应请求。
- 外部 API（Gate.io 理财接口）是否可访问。

### 2. 性能 (Performance)

- API 调用延迟分布。
- 数据处理耗时。
- 并发处理能力。

### 3. 正确性 (Correctness)

- 返回的理财 position 数据是否符合预期。
- 错误处理是否恰当。

### 4. 资源使用 (Resource Utilization)

- 内存消耗。
- CPU 使用率。

## 日志规范

### 日志级别

- **ERROR**：API 调用失败、数据映射异常、服务注册失败。
- **WARN**：价格获取失败（使用默认值）、零余额过滤、API 响应字段缺失。
- **INFO**：服务启动、成功处理请求（可记录请求摘要）。
- **DEBUG**：详细请求/响应数据、映射过程细节。

### 日志字段

所有日志应包含以下通用字段：

- `timestamp`: ISO 8601 时间戳。
- `level`: 日志级别。
- `service`: `vendor-gate`。
- `module`: `earning-account`。
- `trace_id`: 请求追踪 ID（如果存在）。
- `credential_id`: 凭证标识（如 access_key 哈希，不泄露完整密钥）。

### 关键日志点

#### 1. 服务注册

```typescript
logger.info('Earning account service registered', {
  module: 'earning-account',
  account_id: accountIds.earning,
});
```

#### 2. API 调用成功

```typescript
logger.info('Earn balance API succeeded', {
  module: 'earning-account',
  currency_count: balances.length,
  duration_ms: Date.now() - startTime,
});
```

#### 3. API 调用失败

```typescript
logger.error('Earn balance API failed', {
  module: 'earning-account',
  error: error.message,
  duration_ms: Date.now() - startTime,
});
```

#### 4. 价格获取失败

```typescript
logger.warn('Spot price not found, using default', {
  module: 'earning-account',
  currency,
  default_price: 1,
});
```

## 指标 (Metrics)

### 计数器 (Counters)

- `vendor_gate_finance_api_calls_total`：API 调用总次数，标签：`status` (`success`, `error`), `currency`。
- `vendor_gate_earning_account_requests_total`：理财账户请求总次数，标签：`status`。
- `vendor_gate_earning_account_positions_total`：返回的 position 总数。

### 直方图 (Histograms)

- `vendor_gate_finance_api_duration_seconds`：API 调用耗时分布，桶：`[0.05, 0.1, 0.2, 0.5, 1, 2]`。
- `vendor_gate_earning_account_processing_duration_seconds`：数据处理耗时分布，桶：`[0.001, 0.005, 0.01, 0.05, 0.1]`。

### 测量点实现

使用 Prometheus client library 暴露指标，端点：`/metrics`。

## 告警规则

### 紧急告警 (Pager)

- **Earn API 错误率过高**：`rate(vendor_gate_earn_api_calls_total{status="error"}[5m]) / rate(vendor_gate_earn_api_calls_total[5m]) > 0.05` 持续 5 分钟。
- **服务不可用**：`up{service="vendor-gate"} == 0` 持续 2 分钟。

### 警告告警 (Warning)

- **API 延迟过高**：`histogram_quantile(0.95, rate(vendor_gate_earn_api_duration_seconds_bucket[5m])) > 1` 持续 10 分钟。
- **处理延迟过高**：`histogram_quantile(0.95, rate(vendor_gate_earning_account_processing_duration_seconds_bucket[5m])) > 0.2` 持续 10 分钟。

## 链路追踪

### 追踪点

1. `getAccountInfo` 请求入口。
2. `getEarnBalance` API 调用。
3. 价格获取调用（`getSpotPrice`）。
4. 数据映射过程。

### 实现建议

使用 OpenTelemetry 或类似的分布式追踪系统，在关键函数添加 span。

## 健康检查

### 就绪检查 (Readiness Probe)

- 端点：`/health/ready`
- 检查内容：服务是否成功注册了 `AccountActions` 服务。
- 返回状态：200 表示就绪，503 表示未就绪。

### 存活检查 (Liveness Probe)

- 端点：`/health/live`
- 检查内容：进程是否正常运行。
- 返回状态：200 表示存活。

## 故障排查指南

### 常见问题

1. **API 返回 401 错误**：凭证无效或过期。
2. **返回的 position 数量为 0**：所有理财余额为零，或数据映射错误。
3. **处理延迟高**：价格获取慢或 API 响应慢。

### 调试命令

```bash
# 查看服务注册状态
curl http://localhost:3000/health/ready

# 查看指标
curl http://localhost:3000/metrics | grep vendor_gate

# 手动触发理财账户查询
curl -X POST http://localhost:3000/rpc -H 'Content-Type: application/json' -d '{
  "method": "AccountActions/GetAccountInfo",
  "params": {
    "credential": { "access_key": "...", "secret_key": "..." },
    "account_id": "gate/123456/earning"
  }
}'
```

## 部署检查清单

- [ ] 日志级别配置正确。
- [ ] 指标端点 `/metrics` 可访问。
- [ ] 告警规则已配置。
- [ ] 健康检查端点已集成。
- [ ] 追踪配置已启用（如使用 OpenTelemetry）。
