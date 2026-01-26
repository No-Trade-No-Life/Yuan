# node-unit-deployment-grafana-dashboard - 上下文

## 会话进展 (2026-01-12)

### ✅ 已完成

- 已阅读 `.c1-cellar/dashboard.json`：datasource 变量为 `datasource`（prometheus），默认 refresh=10s、time=now-5m、UTC、dark 风格，面板主要为 `graph` + `table-old`。
- 确认 node-unit 指标 label：deployment_id、package_name、package_version、node_unit_name、node_unit_address、pid（来源：`apps/node-unit/src/index.ts` 与 `apps/node-unit/monitoring.md`）。
- 已生成新的 Grafana dashboard：`.c1-cellar/dashboard-node-unit-deployment.json`，包含 CPU/Memory 总量、按 deployment 维度趋势、TopN 与 1h 峰值面板，并接入 node_unit 相关变量。
- 调整 CPU Rate by Deployment 面板的 legend，追加 package_name 以便识别来源。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策 | 原因 | 替代方案 | 日期 |
| ---- | ---- | -------- | ---- |

---

## 快速交接

**下次继续从这里开始：**

1. 在 Grafana 中导入 `.c1-cellar/dashboard-node-unit-deployment.json` 并确认数据源名称与变量能正常解析。
2. 若数据量较大，考虑把 `max_over_time` 的窗口从 1h 调整为更短或改用录制规则。

**注意事项：**

- 仅用 `python -m json.tool` 校验了 JSON 语法，未在 Grafana 实际导入验证。

---

_最后更新: 2026-01-13 14:01 by Claude_
