# Walkthrough: Refactor Grafana Dashboard for IP/Hostname

## 1. 目标与范围 (Goal & Scope)

本变更旨在重构 `http-proxy` 的 Grafana 仪表板，将核心监控维度从过时的 `region`/`tier` 迁移到运维更关注的 `ip`/`hostname`，并确保底层服务正确注入这些标签。

- **Scope**:
  - `libraries/http-services/grafana-dashboard.json`
  - `libraries/http-services/src/server.ts`

## 2. 设计摘要 (Design Summary)

- **RFC**: [RFC Document](./rfc.md)
- **核心逻辑**:
  1. **服务端 (Server)**: 修改 `server.ts`，将服务启动时配置的 `service.labels`（包含 IP/Hostname）自动注入到所有 Prometheus 指标中。
  2. **仪表板 (Dashboard)**:
     - **变量**: 移除 `region`, `tier`；新增 `ip`, `hostname`（支持多选/全选）。
     - **查询**: 所有 PromQL 增加 `{ip=~"$ip", hostname=~"$hostname"}` 过滤。
     - **展示**: 将聚合维度调整为 `by (ip)` 或 `by (hostname)`。

## 3. 改动清单 (Changes List)

### 3.1 Backend (`server.ts`)

- **Metric Label Injection**:
  - 在初始化 Prometheus Registry 时，将 `service.labels` 转换为默认标签注入。
  - 确保 `http_proxy_requests_total` 等指标携带 `ip` 和 `hostname` 标签。

### 3.2 Dashboard (`grafana-dashboard.json`)

- **Variables**:
  - 🗑️ Removed: `region`, `tier`
  - ✨ Added: `ip`, `hostname` (Source: `label_values(http_proxy_requests_total, ...)`)
- **Panels**:
  - **Requests by IP**: 替换原 "Requests by Region"，使用 `topk(10, sum by (ip) ...)` 防止基数爆炸。
  - **Success Rate by IP**: 替换原 "Success Rate by Region"。
  - **New Panels**:
    - **Requests by Method**: 按 HTTP 方法分类。
    - **Response Codes Breakdown**: 按状态码分类。

## 4. 如何验证 (Verification)

### 4.1 自动化检查

- **Build**: `rush build` 通过，确保 `server.ts` 类型安全。
- **JSON Validation**: `grafana-dashboard.json` 格式校验通过。

### 4.2 手动验证步骤

1. **部署服务**: 部署修改后的 `http-proxy` 服务。
2. **检查指标**:
   ```bash
   curl http://<service-ip>:9090/metrics | grep http_proxy_requests_total
   # 预期输出应包含 ip="..." 和 hostname="..."
   # http_proxy_requests_total{method="GET",status_code="200",ip="10.0.0.1",hostname="node-1"} 1
   ```
3. **导入仪表板**: 将 JSON 导入 Grafana。
4. **验证变量**: 确认顶部的 `ip` 和 `hostname` 下拉框已填充实际值。
5. **验证图表**: 确认图表有数据，且切换变量时面板随之刷新。

## 5. 风险与回滚 (Risks & Rollback)

- **风险**:
  - **基数问题 (High Cardinality)**: 若集群规模极大（数千 Pod），`by (ip)` 可能导致图表渲染变慢。
    - _缓解_: 关键面板使用了 `topk(10)` 限制展示数量。
  - **数据中断**: 如果 Prometheus 未抓取到新标签，图表将为空。
- **回滚**:
  - `git revert` 本次 PR。
  - 重新导入旧版 JSON Dashboard。

## 6. 下一步 (Next Steps)

- 监控生产环境 Dashboard 加载性能。
- 收集运维团队反馈，确认 IP/Hostname 分组是否满足日常排障需求。
