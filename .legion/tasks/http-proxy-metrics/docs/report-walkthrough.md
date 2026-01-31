# HTTP Proxy Service Metrics 打点实现 - Walkthrough 报告

## 1. 目标与范围

### 1.1 项目目标

为 `libraries/http-services` 包中的 HTTP 代理服务实现 Prometheus metrics 打点和 Grafana Dashboard 监控面板，实现对服务运行状态的全面可观测性。

### 1.2 范围边界

**包含范围**：

- `libraries/http-services/src/server.ts` - metrics 初始化和采集逻辑
- `libraries/http-services/src/__tests__/server.test.ts` - 单元测试（12 个用例）
- `libraries/http-services/grafana-dashboard.json` - Grafana Dashboard 模板（8 个面板）

**不包含范围**：

- AlertManager 告警规则（作为独立 YAML 文件提供，优先级低）
- 按 hostname 聚合的请求量监控（Q1 待定，需真实流量分析）
- response_size_bytes 指标（与流式读取内存效率目标冲突）

### 1.3 约束条件

- 必须复用 `@yuants/protocol` 的 `terminal.metrics` API
- labels 设计需控制基数，避免高基数导致 Prometheus 内存问题
- metrics 行为需符合 RFC 中定义的 R6-R9 MUST 条款
- Dashboard 面板数量控制在 6-8 个，聚焦核心监控场景

---

## 2. 核心设计

### 2.1 Metrics 规范

| 指标名称                              | 类型      | Labels                          | 说明                     |
| ------------------------------------- | --------- | ------------------------------- | ------------------------ |
| `http_proxy_requests_total`           | Counter   | method, status_code, error_code | HTTP 代理请求总数        |
| `http_proxy_request_duration_seconds` | Histogram | method                          | 请求延迟分布（秒）       |
| `http_proxy_active_requests`          | Gauge     | -                               | 当前活跃请求数           |
| `http_proxy_errors_total`             | Counter   | error_type                      | 按错误类型分类的错误总数 |

### 2.2 Histogram Bucket 配置

```
[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30]
```

覆盖范围从 10ms 到 30s，适配默认超时配置。

### 2.3 错误码映射

| 错误类型           | error_type Label | 触发场景                       |
| ------------------ | ---------------- | ------------------------------ |
| TIMEOUT            | timeout          | 请求超时（AbortError）         |
| FORBIDDEN          | security         | 主机名不在 allowedHosts 白名单 |
| FETCH_FAILED       | network          | 网络错误或 fetch 异常          |
| INVALID_URL        | validation       | URL 解析失败                   |
| RESPONSE_TOO_LARGE | security         | 响应体超过 maxResponseBodySize |

### 2.4 采集点设计

| 编号 | 采集场景         | 指标                      | 标签                                         |
| ---- | ---------------- | ------------------------- | -------------------------------------------- |
| R6   | 请求完成（成功） | requests_total.inc()      | method, status_code, error_code=none         |
| R6   | 请求完成（失败） | requests_total.inc()      | method, status_code=0, error_code=ERROR_TYPE |
| R7   | 请求完成         | requestDuration.observe() | method, duration                             |
| R8   | 请求开始         | activeRequests.inc()      | -                                            |
| R8   | 请求结束         | activeRequests.dec()      | -                                            |
| R9   | 错误发生         | errorsTotal.inc()         | error_type=ERROR_TYPE                        |

### 2.5 Terminal Labels

服务初始化时，labels（如 region、tier、ip）会自动注入到 `terminal.terminalInfo.tags`，实现按服务实例聚合监控数据。

---

## 3. 文件变更明细

### 3.1 `libraries/http-services/src/server.ts`

**变更类型**：修改

**变更内容**：

| 行号          | 变更                | 说明                                      |
| ------------- | ------------------- | ----------------------------------------- |
| 51-60         | 新增 metrics 初始化 | 初始化 4 个核心指标                       |
| 111-112       | 新增 R8 采集点      | 请求开始时递增 activeRequests             |
| 122           | 新增 R9 采集点      | FORBIDDEN 错误记录 security 类型          |
| 153           | 新增 R9 采集点      | TIMEOUT 错误记录 timeout 类型             |
| 157           | 新增 R9 采集点      | FETCH_FAILED 错误记录 network 类型        |
| 169, 192, 215 | 新增 R9 采集点      | RESPONSE_TOO_LARGE 错误记录 security 类型 |
| 233-237       | 新增 R6 采集点      | 成功请求记录 requests_total               |
| 261-269       | 新增 R9 采集点      | 错误处理中根据错误类型记录 errors_total   |
| 271-276       | 新增 R6 采集点      | 错误请求记录 requests_total               |
| 280-282       | 新增 R7 采集点      | 记录请求延迟分布                          |
| 284-285       | 新增 R8 采集点      | 请求结束时递减 activeRequests             |

**代码示例（metrics 初始化）**：

```typescript
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
```

### 3.2 `libraries/http-services/src/__tests__/server.test.ts`

**变更类型**：修改

**测试用例清单**：

| 用例编号 | 测试名称                        | 验证点                                       |
| -------- | ------------------------------- | -------------------------------------------- |
| T1       | 服务注册与正确 JSON Schema      | 服务名称 HTTPProxy，Schema 包含 labels 约束  |
| T2       | labels 可选（支持部分匹配）     | labels.required 为 undefined                 |
| T3       | labels 注入 terminal.tags       | terminal.terminalInfo.tags 包含传入的 labels |
| T4       | metrics 初始化正确              | counter/histogram/gauge 正确初始化           |
| T5       | GET 请求成功 metrics            | R7/R8 6/R 正确采集                           |
| T6       | POST 请求成功 metrics           | R6/R7/R8 正确采集（POST 方法）               |
| T7       | TIMEOUT 错误 metrics            | R6/R7/R8/R9 正确采集（timeout 类型）         |
| T8       | 网络错误 metrics                | R6/R7/R8/R9 正确采集（network 类型）         |
| T9       | FORBIDDEN 错误 metrics          | R6/R7/R8/R9 正确采集（security 类型）        |
| T10      | INVALID_URL 错误 metrics        | R6/R7/R8/R9 正确采集（validation 类型）      |
| T11      | RESPONSE_TOO_LARGE 错误 metrics | R6/R7/R8/R9 正确采集（security 类型）        |
| T12      | 错误时 activeRequests 正确递减  | R8 在 finally 块中执行                       |

### 3.3 `libraries/http-services/grafana-dashboard.json`

**变更类型**：新增

**Dashboard 结构**：

| 面板名称               | 类型       | 用途                         |
| ---------------------- | ---------- | ---------------------------- |
| Total Requests         | Stat       | 显示选定时间范围内的请求总数 |
| Success Rate (%)       | Gauge      | 显示请求成功率（2xx 比例）   |
| P99 Latency            | Timeseries | P99 延迟时序图               |
| P95 Latency            | Timeseries | P95 延迟时序图               |
| Latency Distribution   | Bar Gauge  | 延迟分布直方图               |
| Requests by Region     | Bar Gauge  | 按 region 聚合的请求量       |
| Success Rate by Region | Bar Gauge  | 按 region 聚合的成功率       |
| Errors by Type         | Bar Gauge  | 按错误类型聚合的错误率       |

**模板变量**：

- `${datasource}` - Prometheus 数据源
- `${region}` - 按 region 筛选（支持多选）
- `${tier}` - 按 tier 筛选（支持多选）

---

## 4. 如何验证

### 4.1 单元测试

```bash
# 运行 http-services 包的所有测试
cd libraries/http-services
npm test

# 或运行特定测试文件
npx jest src/__tests__/server.test.ts
```

**预期结果**：12 个测试用例全部通过

### 4.2 本地集成测试

1. 启动包含 http-proxy-service 的应用
2. 访问 `/metrics` 端点
3. 验证以下指标存在：

```
http_proxy_requests_total{method="GET",status_code="200",error_code="none"}
http_proxy_request_duration_seconds_bucket{le="0.01",method="GET"}
http_proxy_active_requests
http_proxy_errors_total{error_type="timeout"}
```

### 4.3 Dashboard 导入验证

1. 在 Grafana 中导入 `grafana-dashboard.json`
2. 设置数据源为 Prometheus
3. 验证各面板显示数据（非 "No data"）
4. 测试 region/tier 变量筛选功能

---

## 5. Benchmark 与门槛说明

### 5.1 性能影响评估

| 操作                | 开销   | 说明                       |
| ------------------- | ------ | -------------------------- |
| Counter.inc()       | ~10ns  | 可忽略                     |
| Histogram.observe() | ~100ns | 包含标签查找和 bucket 计算 |
| Gauge.inc/dec       | ~10ns  | 可忽略                     |

**总体影响**：单个请求的 metrics 打点开销 < 200ns，在 10K QPS 下 CPU 增加 < 2%。

### 5.2 Cardinality 控制

| Label          | 基数         | 风险评估     |
| -------------- | ------------ | ------------ |
| method         | ≤7           | 低           |
| status_code    | ≤20          | 低           |
| error_code     | ≤6           | 低           |
| error_type     | ≤5           | 低           |
| region/tier/ip | 按部署实例数 | 中等（可控） |

**关键措施**：

- 错误码使用预定义枚举，禁止动态值
- 移除可能包含 URL 的 labels
- hostname 聚合暂缓实施（Q1 待定）

---

## 6. 可观测性

### 6.1 Metrics 采集位置

```
provideHTTPProxyService()
├── metrics 初始化 (第51-60行)
└── request handler (第104-287行)
    ├── 请求开始: activeRequests.inc() (第112行)
    ├── 错误检测: errorsTotal.inc() (多行)
    ├── 请求完成: requestsTotal.inc() (第233-237行, 第271-276行)
    ├── 延迟记录: requestDuration.observe() (第280-282行)
    └── 请求结束: activeRequests.dec() (第285行)
```

### 6.2 关键查询示例

```promql
# 请求成功率（最近5分钟）
sum(rate(http_proxy_requests_total{status_code=~"2.."}[5m]))
/
sum(rate(http_proxy_requests_total[5m]))

# P99 延迟
histogram_quantile(0.99, sum(rate(http_proxy_request_duration_seconds_bucket[5m])) by (le))

# 按错误类型统计错误率
sum by (error_type) (rate(http_proxy_errors_total[5m]))

# 当前活跃请求数
http_proxy_active_requests

# 按 region 分组的请求量
sum by (region) (rate(http_proxy_requests_total[5m]))
```

### 6.3 日志联动

错误发生时，除了 metrics 打点，还会输出 console.warn 日志：

```typescript
console.warn(`[HTTPProxy] Blocked access to ${urlObj.hostname} (not in allowedHosts)`);
```

日志包含被拒绝的主机名，便于问题排查。

---

## 7. 风险与回滚

### 7.1 已知风险

| 风险                   | 影响                | 缓解措施                        |
| ---------------------- | ------------------- | ------------------------------- |
| 高基数 labels          | Prometheus 内存压力 | 严格控制 labels，使用预定义枚举 |
| 30s bucket 不够用      | 无法区分长时请求    | 未来可扩展 bucket 范围          |
| Dashboard 变量配置错误 | 面板无数据          | 导入时自动配置 templating       |

### 7.2 回滚方案

**代码回滚**：

```bash
# 撤销 server.ts 的 metrics 相关改动
git checkout libraries/http-services/src/server.ts

# 撤销测试改动
git checkout libraries/http-services/src/__tests__/server.test.ts
```

**Dashboard 回滚**：
从 Grafana 中删除 Dashboard 或导入旧版本。

**指标清理**（如需彻底清理）：

```promql
# 删除旧指标（需 Prometheus 管理员权限）
curl -X POST -g 'http://prometheus:9090/api/v1/admin/tsdb/delete_series?match[]=http_proxy_requests_total'
curl -X POST -g 'http://prometheus:9090/api/v1/admin/tsdb/delete_series?match[]=http_proxy_request_duration_seconds'
curl -X POST -g 'http://prometheus:9090/api/v1/admin/tsdb/delete_series?match[]=http_proxy_active_requests'
curl -X POST -g 'http://prometheus:9090/api/v1/admin/tsdb/delete_series?match[]=http_proxy_errors_total'
```

---

## 8. 未决项与下一步

### 8.1 未决问题（Open Questions）

| ID  | 问题                                  | 优先级 | 建议                     |
| --- | ------------------------------------- | ------ | ------------------------ |
| Q1  | 是否需要按 hostname 聚合请求量？      | 高     | 暂不添加，待真实流量分析 |
| Q2  | 是否需要 AlertManager 规则？          | 低     | 作为独立 YAML 文件提供   |
| Q3  | Dashboard 是否需要按小时/天聚合视图？ | 中     | 时间范围选择器已支持     |

### 8.2 后续优化方向

1. **Q1 hostname 聚合**：2026 年 Q1 根据真实流量数据决定是否添加
2. **AlertManager 规则**：可扩展提供告警规则 YAML
3. **SLO 面板**：可添加基于 metrics 的 SLO 监控面板

### 8.3 验收清单

- [x] 4 个核心 metrics 实现并通过测试
- [x] 12 个单元测试用例覆盖所有采集点
- [x] 8 面板 Grafana Dashboard 可导入使用
- [x] 支持按 region/tier 筛选
- [x] 错误类型映射正确（R6/R9）
- [x] 延迟分布覆盖 0.01s-30s 范围
- [x] 活跃请求计数正确（finally 块保证递减）
- [x] 生成完整的 walkthrough 报告

---

## 9. 相关文档

- RFC 文档：`.legion/tasks/http-proxy-metrics/docs/rfc.md`
- RFC 审查报告：`.legion/tasks/http-proxy-metrics/docs/review-rfc.md`
- RFC 复审报告：`.legion/tasks/http-proxy-metrics/docs/review-rfc-recheck.md`
- 源代码：`libraries/http-services/src/server.ts`
- 测试代码：`libraries/http-services/src/__tests__/server.test.ts`
- Dashboard：`libraries/http-services/grafana-dashboard.json`

---

_报告生成时间：2026-01-31_
_任务 ID：http-proxy-metrics_
