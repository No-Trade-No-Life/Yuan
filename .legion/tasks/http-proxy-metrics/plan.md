# HTTP Proxy Service Metrics 打点与 Dashboard

**TITLE**: HTTP Proxy Service Metrics 打点方案
**SLUG**: http-proxy-metrics
**RFC 真源**: [docs/rfc.md](./docs/rfc.md)

---

## 目标

为 http-proxy-service 实现 Prometheus metrics 打点并创建 Grafana Dashboard，实现对每个 HTTP Proxy Terminal 的可观测性覆盖。

---

## 摘要

### 核心流程

在 `provideHTTPProxyService` 中新增 metrics 初始化代码，于请求处理 handler 的关键节点（开始、结束、异常）采集 4 个核心指标：请求计数、延迟直方图、活跃请求 Gauge、错误计数。

### 接口变更

- 无需修改 `IHTTPProxyRequest` / `IHTTPProxyResponse` 类型
- 使用 `terminal.metrics` 获取 Prometheus registry
- 从 `terminal.terminalInfo.tags` 提取 region、tier、ip 作为可选 Label

### 文件变更清单

- `libraries/http-services/src/server.ts` — 添加 metrics 初始化和采集逻辑
- `libraries/http-services/src/__tests__/server.test.ts` — 添加 metrics 单元测试
- `libraries/http-services/grafana-dashboard.json` — 新增 Grafana Dashboard 模板

### 验证策略

- 单元测试：覆盖 R6-R9 所有 MUST 行为断言
- 集成测试：本地启动 Terminal，验证 `/metrics` 端点输出
- Dashboard 验证：导入 JSON 模板，确认各面板有数据且查询正确

---

## 范围

- `libraries/http-services/src/server.ts` — 添加 metrics 打点
- `libraries/http-services/src/__tests__/server.test.ts` — metrics 单元测试
- `libraries/http-services/grafana-dashboard.json` — Grafana Dashboard 模板（7 个核心面板）

---

## 阶段概览

1. **阶段 1：Metrics 设计** — 设计 metrics 规范和 Dashboard 布局（本文档阶段）
2. **阶段 2：Metrics 实现** — 在 server.ts 中实现打点逻辑
3. **阶段 3：Dashboard 实现** — 创建 Grafana Dashboard 模板

---

_创建于：2026-01-30_
_最后更新：2026-01-30_
