# RFC 审查报告：HTTP Proxy Service Metrics 打点方案

**RFC ID**: http-proxy-metrics-001  
**审查日期**: 2026-01-30  
**审查者**: 对抗审查 Agent (奥卡姆剃刀原则)  
**状态**: ⚠️ **需修正后通过**

---

## 执行摘要

RFC 文档整体质量良好，设计思路清晰，覆盖了 HTTP 代理服务的核心可观测性需求。但在 **指标必要性**、**Cardinality 风险**、**Dashboard 复杂度** 三个维度存在过度设计倾向，建议精简后实施。

**核心建议**：

- ❗ 移除 `http_proxy_response_size_bytes` 或证明其必要性
- ❗ 修正 `http_proxy_errors_total.reason` Label 的高基数风险
- ⚠️ Dashboard 面板从 12+ 精简至 6-8 个核心面板
- ⚠️ 明确 Q1（hostname 聚合）的决策后再实现

---

## 1. ✅ 通过的条款

### 1.1 指标设计合理性

| 条款                                  | 评价    | 说明                                                                                    |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `http_proxy_requests_total`           | ✅ 通过 | Counter + method/status_code/error_code 三维标签，覆盖请求全貌                          |
| `http_proxy_request_duration_seconds` | ✅ 通过 | Histogram 支持 P50/P95/P99 百分位，满足 SRE SLA 监控需求                                |
| `http_proxy_active_requests`          | ✅ 通过 | Gauge 监控并发连接数，利于 DoS 攻击检测和容量规划                                       |
| 错误码枚举定义                        | ✅ 通过 | `none`/`TIMEOUT`/`FORBIDDEN`/`FETCH_FAILED`/`INVALID_URL`/`RESPONSE_TOO_LARGE` 覆盖完整 |
| R6-R10 MUST 行为                      | ✅ 通过 | 采集点设计完整，finally 块保证 dec() 调用避免 Gauge 泄漏                                |

### 1.2 一致性检查

- **命名风格一致**：遵循 `yuants/protocol` 的 snake*case 命名（`http_proxy*\*`）
- **Label 设计一致**：复用 `terminal.terminalInfo.tags` 中的 region/tier/ip
- **API 调用模式一致**：使用 `terminal.metrics.counter/histogram/gauge` 标准 API

### 1.3 非目标边界清晰

- N1: 不修改类型定义 ✅ 遵守
- N2: 不引入新日志格式 ✅ 遵守
- N3: 不实现 AlertManager 规则 ✅ 遵守
- N4: 不处理 Tracing ✅ 遵守

### 1.4 测试可行性

- 9.1 测试映射表完整，每个 R 条款都有对应测试用例
- Mock 模式清晰，可注入 mockMetrics 进行单元测试

---

## 2. ❌ 必须修正的问题

### 2.1 问题：response_size Histogram 必要性未充分论证

**位置**: 4.1 节、4.2.4 节、6.2.1 节

**问题描述**：

```
http_proxy_response_size_bytes Histogram
```

此指标的存在价值存疑：

1. **代理服务核心价值不在响应大小**：HTTP 代理的核心价值是请求转发，响应大小是上游服务的行为，非代理可控
2. **性能开销**：流式读取场景下，计算 `receivedLength` 需要累积所有 chunk，与流式设计的内存效率目标冲突
3. **用户需求存疑**：Dashboard 设计中未单独展示 response_size 面板，说明业务价值优先级低

**奥卡姆剃刀**：

> "若无必要，勿增实体"

**建议**：

- **方案 A（推荐）**：移除 `http_proxy_response_size_bytes`，简化实现
- **方案 B**：若团队确实需要，在 6.2.1 节补充面板设计，并在 RFC 中明确用例（如：检测异常大响应导致内存压力）

**修正要求**：

> 需在 RFC 中明确回答：哪个业务场景需要监控 HTTP 代理的响应大小？如果无法回答，请移除此指标。

---

### 2.2 问题：errors_total.reason Label 存在高基数风险

**位置**: 4.2.5 节、4.4 节、伪代码 5.2.7 行

**问题描述**：

```typescript
errorsTotal.labels({ error_type: 'timeout', reason: req.url }).inc();
errorsTotal.labels({ error_type: 'network', reason: err?.message || 'unknown' }).inc();
```

`reason` Label 存在严重的高基数风险：

1. **URL 作为 Label 值**：每个不同的 URL 都会产生新的时间序列，Cardinality = 唯一 URL 数量
2. **错误消息动态内容**：`err?.message` 可能包含堆栈、参数等动态内容，进一步加剧基数问题

**风险等级**：🔴 高 — 可能导致 Prometheus 内存耗尽

**修正建议**：

```typescript
// 方案 A：移除 reason Label（推荐）
errorsTotal.labels({ error_type: 'timeout' }).inc();

// 方案 B：使用哈希值降维（复杂）
const reasonHash = hash(req.url); // 但这破坏了可读性
```

**修正要求**：

> 将 `reason` 从 Label 移除，仅保留 `error_type`。如需调试信息，依赖日志而非 metrics。

---

### 2.3 问题：Dashboard 面板过多且缺乏优先级

**位置**: 6.2.1 - 6.2.4 节

**问题描述**：
当前设计包含 **16 个面板**（4 Row × 4 Panel），存在以下问题：

1. **认知负荷高**：运维人员难以快速定位关键指标
2. **空间浪费**：部分面板功能重叠（如 "Errors by Type" 和 "Error Trend"）
3. **实现成本**：每个面板都需要 Query 调优和样式调整

**建议精简**：

| Row           | 保留面板                                   | 移除面板                                         | 理由                                         |
| ------------- | ------------------------------------------ | ------------------------------------------------ | -------------------------------------------- |
| 全局概览      | Total Requests, Success Rate               | Requests/sec, Error Rate                         | P99 延迟已能反映性能，成功率=1-错误率        |
| 延迟分布      | P95 Latency, P99 Latency                   | P50 Latency, Latency Heatmap                     | P50 变化不敏感，Heatmap 实用性低             |
| Terminal 分组 | Requests by Region, Success Rate by Region | Tier 相关面板                                    | 先聚焦 Region，Tier 可后续补充               |
| 错误分析      | Errors by Type                             | Error Trend, Error Count by Region, Timeout Rate | 精简错误视图，Trend 可通过时间范围选择器实现 |

**修正后面板数**：6-8 个核心面板

**修正要求**：

> 重写 6.2 节，移除冗余面板，保留高价值面板。每个面板需说明其用户故事。

---

### 2.4 问题：Histogram Bucket 配置未验证

**位置**: 4.2.2 节、4.2.4 节

**问题描述**：

```typescript
buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
```

Bucket 配置：

- **上界 10s**：是否覆盖所有业务场景？超时默认 30s，10s Bucket 无法区分 10-30s 的请求
- **下界 0.005s (5ms)**：对 HTTP 代理是否过于精细？通常代理延迟在 10ms+ 级别

**修正建议**：

```typescript
// 方案：扩展上界，覆盖完整超时范围
buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];
```

**修正要求**：

> 补充 Bucket 配置的业务依据，说明为何选择当前值。如有可能，附上真实流量 P99 延迟数据。

---

## 3. ⚠️ 潜在风险

### 3.1 性能影响风险

**风险描述**：metrics 打点的计算开销

**分析**：

- Counter/Histogram observe 操作开销极低（纳秒级）
- `Date.now()` 调用在热路径中每请求一次，可接受
- 风险点：`terminalLabels` 提取可能涉及可选链和对象访问，但仅在服务初始化时执行一次

**结论**：✅ 性能影响可忽略

### 3.2 并发安全性风险

**风险描述**：`activeRequests.inc()/dec()` 的并发安全

**分析**：

- Node.js 单线程模型下，`inc()`/`dec()` 是原子操作
- 但在极端并发场景下（如 10k+ 并发请求），可能存在时序问题

**缓解措施**：使用 `finally` 块保证 dec() 一定执行，RFC 已覆盖

### 3.3 错误码一致性风险

**风险描述**：`requestsTotal.error_code` vs `errorsTotal.error_type` 存在语义差异

| 指标             | Label        | 取值                                           |
| ---------------- | ------------ | ---------------------------------------------- |
| `requests_total` | `error_code` | `none`, `TIMEOUT`, `FORBIDDEN`, ...            |
| `errors_total`   | `error_type` | `timeout`, `security`, `network`, `validation` |

**问题**：命名不一致（code vs type）、取值不一致（TIMEOUT vs timeout）

**建议**：统一命名规范，建议都使用 snake_case 小写

---

## 4. 💡 优化建议

### 4.1 指标命名规范化

**建议**：统一使用小写+下划线

```
http_proxy_requests_total          ✅
http_proxy_request_duration_seconds ✅
http_proxy_active_requests          ✅
http_proxy_response_size_bytes      ⚠️（建议移除）
http_proxy_errors_total             ⚠️（error_type 改用小写）
```

### 4.2 补充生产环境验证步骤

**位置**: 11.3 节

**建议补充**：

```markdown
### 生产验证清单

- [ ] Prometheus `/metrics` 端点输出验证
- [ ] Cardinality 监控：确认 Label 基数在预期范围
- [ ] 压力测试：1000 rps 持续 10min，性能无退化
- [ ] 告警验证：模拟错误，触发告警通知
```

### 4.3 补充 Grafana Panel JSON 示例

**位置**: 6.1 节

**建议**：提供至少一个完整 Panel JSON 示例，而非仅描述 Query。便于实现者直接复用。

### 4.4 考虑引入 SLI/SLO 框架

**建议**：在 Dashboard 中显式标注 SLA 阈值线

```
P99 Latency < 500ms  [绿色区域]
P99 Latency 500ms-1s [黄色告警]
P99 Latency > 1s     [红色告警]
```

---

## 5. 决策矩阵

| 问题                | 选项        | 建议           | 理由                           |
| ------------------- | ----------- | -------------- | ------------------------------ |
| response_size       | 保留 / 移除 | **移除**       | 代理核心价值不在此，降低复杂度 |
| errors_total.reason | 保留 / 移除 | **移除**       | 高基数风险，调试依赖日志       |
| Dashboard 面板数    | 16 / 8      | **精简至 6-8** | 降低认知负荷，突出核心指标     |
| Bucket 配置         | 现有 / 扩展 | **扩展至 30s** | 覆盖完整超时范围               |
| Q1 hostname 聚合    | 实现 / 暂缓 | **暂缓**       | 先验证真实需求，避免过度设计   |

---

## 6. 审查结论

### 通过条件

完成以下修改后，RFC 可批准进入实现阶段：

1. **移除** `http_proxy_response_size_bytes` 指标，或提供充分业务论证
2. **移除** `errors_total.reason` Label，或改用固定枚举值
3. **精简** Dashboard 面板至 6-8 个核心面板
4. **扩展** Histogram Bucket 至 30s 上界
5. **明确** Q1 决策（hostname 聚合）

### 下一步行动

| 负责人   | 行动项                  | 截止日期   |
| -------- | ----------------------- | ---------- |
| RFC 作者 | 修正上述 5 项           | 待定       |
| 审查者   | 复审修正后的 RFC        | 修正完成后 |
| SRE 团队 | 确认 Dashboard 面板需求 | RFC 批准前 |

---

**审查报告版本**: v1.0  
**生成时间**: 2026-01-30  
**下次审查**: 修正后
