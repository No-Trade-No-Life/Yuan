# RFC: 为 Grafana Dashboard 重构 IP/Hostname 分组

- **状态**: Approved
- **任务 ID**: `refactor-grafana-dashboard-for-iphostname`
- **目标路径**: `libraries/http-services/grafana-dashboard.json`
- **创建时间**: 2026-01-31

## 1. 摘要 (Abstract)

本 RFC 提议对 `http-proxy` Grafana 仪表板进行结构性更新。我们将把主要分组维度从 `region`/`tier` 转换为 `ip`/`hostname`，以便更好地满足跟踪单个实例健康状况的运维需求。此外，还将引入针对请求方法、响应代码细分和按 IP 统计错误率的新面板。

## 2. 动机 (Motivation)

当前的仪表板依赖于 `region` 和 `tier` 标签，这些标签要么已被弃用，要么粒度不足以满足当前的调试工作流需求。运维人员需要按实例（IP 或 Hostname）可视化流量和健康指标，以识别集群中的“坏苹果”。

## 3. 目标与非目标 (Goals & Non-Goals)

**目标**:

- 用 Hostname 和 IP 替换 Region/Tier 变量。
- 更新现有面板以使用新的分组维度。
- 添加高价值指标：方法细分、响应代码随时间变化、按错误率排名的 Top IP。
- 确保仪表板与底层 Prometheus 指标（`http_proxy_*`）保持兼容。

**非目标**:

- 更改底层指标名称（Prometheus exporter 端）。
- 添加告警规则（仅限仪表板）。

## 4. 定义与假设 (Definitions & Assumptions)

- **标签策略**: 我们假设 `http_proxy_requests_total` 及相关指标上存在 `ip` 和 `hostname` 标签。这是基于标准 Prometheus 行为和 `server.ts` 中的示例。
- **回退机制**: 如果在某些环境中缺少 `hostname`，`instance` 是标准的 Prometheus 回退选项，但在本 RFC 中我们优先使用 `hostname`。
- **变量**:
  - **IP**: 节点的 IP 地址（标签 `ip`）。
  - **Hostname**: 机器名称（标签 `hostname`）。

## 5. 现状分析 (Current State Analysis)

### 5.1 现有变量

- `region`: `label_values(http_proxy_requests_total, region)` (将被移除)
- `tier`: `label_values(http_proxy_requests_total, tier)` (将被移除)

### 5.2 现有面板

- **Requests by Region**: 按 `region` 汇总流量。(将被移除/替换)
- **Success Rate by Region**: 按 `region` 计算成功率。(将被移除/替换)

## 6. 变更提案 (Proposed Changes)

### 6.1 变量 (R1)

必须使用以下配置替换现有变量。
必须移除 `region` 和 `tier` 变量。

| 名称       | 标签       | 定义                                                | 选项                        |
| ---------- | ---------- | --------------------------------------------------- | --------------------------- |
| `ip`       | IP Address | `label_values(http_proxy_requests_total, ip)`       | Multi=True, IncludeAll=True |
| `hostname` | Hostname   | `label_values(http_proxy_requests_total, hostname)` | Multi=True, IncludeAll=True |

### 6.2 数据模型与标签 (R2)

所有查询必须使用新变量进行过滤：

- `{ip=~"$ip", hostname=~"$hostname"}` 应附加到所有指标选择器。

### 6.3 面板更新 (R3)

| 面板 ID  | 新标题                   | 查询模式                                                                                                                                                                                                                              |
| -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6 (替换) | **Requests by IP**       | `topk(10, sum by (ip) (rate(http_proxy_requests_total{ip=~"$ip", hostname=~"$hostname"}[$__rate_interval])))`                                                                                                                         |
| 7 (替换) | **Success Rate by IP**   | `topk(10, sum by (ip) (rate(http_proxy_requests_total{status_code=~"2..", ip=~"$ip", hostname=~"$hostname"}[$__rate_interval])) / sum by (ip) (rate(http_proxy_requests_total{ip=~"$ip", hostname=~"$hostname"}[$__rate_interval])))` |
| 4 (更新) | **Latency Distribution** | 更新现有查询以添加过滤器 `{ip=~"$ip", hostname=~"$hostname"}`                                                                                                                                                                         |

### 6.4 新面板 (R4)

**A. Requests by Method**

- **查询**: `sum by (method) (rate(http_proxy_requests_total{ip=~"$ip", hostname=~"$hostname"}[$__rate_interval]))`

**B. Response Codes Breakdown**

- **查询**: `sum by (status_code) (rate(http_proxy_requests_total{ip=~"$ip", hostname=~"$hostname"}[$__rate_interval]))`

## 7. 实现细节 (Implementation Details)

### 7.1 JSON 修改

我们将编辑 `libraries/http-services/grafana-dashboard.json`。

1. **变量**: 删除 `region`, `tier`。添加 `ip`, `hostname`。
2. **面板**:
   - 识别使用 `region`/`tier` 的面板，并使用上述 PromQL 重写它们。
   - 插入用于 Method 和 Response Codes 的新面板。
   - 确保使用 `$__rate_interval` 进行速率计算。

## 8. 安全考量 (Security Considerations)

- **基数 (Cardinality)**: 在 "Requests by IP" 和 "Success Rate by IP" 中使用 `topk(10, ...)`，以防止在存在数千个 IP 时导致渲染爆炸。

## 9. 可测试性 (Testability)

- **PromQL 有效性**: 提供的查询必须在语法上正确。
- **变量注入**: 验证选择 "All" 或特定 IP 是否正确更新 PromQL 过滤器。

## 10. 遗留问题 (Open Questions)

- 无。(关于标签 `ip` 和 `hostname` 的假设在此迭代中被认为是可接受的)。

## 11. 计划 (Plan)

1. **修改 JSON**: 在本地更新变量和面板。
2. **审查**: 检查 JSON diff。
3. **提交**: 保存更改。
