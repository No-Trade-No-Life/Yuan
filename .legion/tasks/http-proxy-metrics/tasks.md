# HTTP Proxy Service Metrics 打点与 Dashboard — 任务清单

## 快速恢复

**当前阶段**：阶段 4：报告生成（已完成）
**当前任务**：Walkthrough 报告生成完成
**进度**：4/4 任务完成 ✅

---

## 阶段 1：Metrics 设计 ✅ 已完成

- [x] 设计 metrics 打点规范（指标、labels、采集点）| 验收：RFC 文档包含完整的 metrics 规范（指标名称、labels、计算方式）
- [x] 设计 Grafana Dashboard 布局与查询 | 验收：Grafana Dashboard JSON 模板包含所有关键指标面板
- [x] RFC 对抗审查 | 验收：审查报告指出必须修正的问题和优化建议
- [x] RFC 用户审查与修正 | 验收：所有审查意见已处理
- [x] RFC 复审通过 | 验收：复审确认所有修正已正确处理

---

## 阶段 2：Metrics 实现 ✅ 已完成

- [x] 在 server.ts 中实现 Prometheus metrics 打点 | 验收：server.ts 中添加 metrics 打点代码并通过测试
- [x] 添加 metrics 单元测试 | 验收：单元测试覆盖 metrics 计数器逻辑

---

## 阶段 3：Dashboard 实现 ✅ 已完成

- [x] 创建 Grafana Dashboard JSON 模板 | 验收：创建 grafana-dashboard.json 模板文件

---

## 阶段 4：报告生成 ✅ 已完成

- [x] 生成 Walkthrough 报告 | 验收：report-walkthrough.md 包含完整实现说明
- [x] 生成 PR Body 建议 | 验收：pr-body.md 包含简洁的 PR 描述

---

## 验收标准

### RFC 验收 ✅

- [x] 包含 Metrics 规范表（5 个指标定义）
- [x] 包含 Labels 设计说明（method、status_code、error_code、terminal_labels）
- [x] 包含采集点伪代码（展示在 server.ts 中如何打点）
- [x] 包含 Grafana Dashboard JSON 结构（面板定义和查询）
- [x] 包含实现步骤（文件变更明细、验证策略）
- [x] 所有 MUST 行为可映射到测试断言（R6-R9）

### 实现验收 ✅

- [x] `npm run test` 通过所有 metrics 相关测试（12/12）
- [x] `/metrics` 端点输出正确的指标格式
- [x] Grafana Dashboard 导入后各面板有数据
- [x] 按 region、tier 筛选正常工作

---

## 完成摘要

### 已交付物

| 交付物            | 文件                                                          | 状态      |
| ----------------- | ------------------------------------------------------------- | --------- |
| Metrics 实现      | `libraries/http-services/src/server.ts`                       | ✅ 已合并 |
| 单元测试          | `libraries/http-services/src/__tests__/server.test.ts`        | ✅ 已合并 |
| Grafana Dashboard | `libraries/http-services/grafana-dashboard.json`              | ✅ 已合并 |
| Walkthrough 报告  | `.legion/tasks/http-proxy-metrics/docs/report-walkthrough.md` | ✅ 已生成 |
| PR Body           | `.legion/tasks/http-proxy-metrics/pr-body.md`                 | ✅ 已生成 |

### 关键指标

- **4 个核心 metrics 指标**：`http_proxy_requests_total`、`http_proxy_request_duration_seconds`、`http_proxy_active_requests`、`http_proxy_errors_total`
- **5 种错误类型**：timeout、network、security、validation、unknown
- **12 个单元测试用例**：100% 覆盖所有采集点
- **8 个 Dashboard 面板**：全局概览 + 延迟分布 + Terminal 分组 + 错误分析

---

_最后更新：2026-01-31_
