# node-unit-deployment-grafana-dashboard - 任务清单

## 快速恢复

**当前阶段**: 阶段 3 - 实现
**当前任务**: (none)
**进度**: 3/3 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 阅读 `.c1-cellar/dashboard.json`，整理现有变量、面板风格与数据源命名规则；同时确认两条指标的 label 结构（通过仓库配置或已有查询规则推断）。 | 验收: context.md 记录变量列表、datasource 名称、时间范围/刷新设置，以及 node_unit 指标的 label 假设与不确定点。

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 设计面板列表与查询：CPU rate/利用率、memory RSS、按 deployment/instance TopN、趋势与统计（如 avg/max）。 | 验收: plan.md 明确每个面板的标题、PromQL、legend 与单位/阈值。

---

## 阶段 3: 实现 ✅ COMPLETE

- [x] 基于现有 dashboard.json 复制并生成新的 dashboard JSON，替换为 node_unit_deployment 指标面板。 | 验收: 新 JSON 可导入 Grafana；变量与面板可正常渲染（PromQL/单位/legend 合理）。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-01-12 14:05_
