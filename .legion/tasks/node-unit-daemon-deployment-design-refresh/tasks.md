# node-unit-daemon-deployment-design-refresh - 任务清单

## 快速恢复

**当前阶段**: 阶段 5 - 实现
**当前任务**: 实现 assignment/lease 调度与执行器路径。
**进度**: 4/10 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 阅读 node-unit 调度与 daemon/deployment 相关实现与现有 RFC/文档，整理现状与约束。 | 验收: context.md 记录：现有流程、关键状态、已知限制与风险清单。

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 基于社区最佳实践输出改进设计（模型/状态机/调度流程/容错/观测/迁移）。 | 验收: RFC 完成并可评审，包含对比与决策理由。
- [x] RFC 生成完成。 | 验收: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 可评审。

---

## 阶段 3: 审查 ✅ COMPLETE

- [x] RFC 对抗审查 PASS。 | 验收: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md` 结论为 PASS（可进入门禁）。

---

## 阶段 4: 门禁 ✅ COMPLETE

- [x] 用户批准设计（Design Approved）。 | 验收: 用户明确确认后方可进入实现阶段（/legion-impl）。

---

## 阶段 5: 实现 ⏳ IN PROGRESS

- [x] 实现 `deployment_assignment` 数据模型、调度器 lease/state 流程与回滚 gate。 | 验收: `apps/node-unit/src/scheduler.ts`、`libraries/deploy/src/**`、`tools/sql-migration/sql/deployment.sql` 完成协议落地，核心路径与 RFC 一致。
- [x] 实现 node-unit 执行器 assignment 读取、heartbeat/lease 续租、node 级 applied_generation 上报。 | 验收: `apps/node-unit/src/index.ts` 与相关 API 文档完成更新，assignment/旧地址路径具备 feature flag/fencing。

---

## 阶段 6: 验证 ⏳ PENDING

- [x] 补齐单测与最小仿真测试。 | 验收: `apps/node-unit/src/scheduler.test.ts` 覆盖 lease/selector/fencing/gate，新增或更新脚本覆盖关键 E2E 场景。（本轮已通过 `rush build --to @yuants/node-unit` 内置 test/build）
- [ ] 执行构建与端到端验证。 | 验收: 相关 build/test/E2E 命令完成，结果写入任务文档。 ← CURRENT

---

## 阶段 7: Review / 报告 ⏳ PENDING

- [ ] 完成代码 Review 报告。 | 验收: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-code.md` 生成。
- [ ] 完成安全 Review 报告。 | 验收: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-security.md` 生成。
- [ ] 完成 walkthrough 报告。 | 验收: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/report-walkthrough.md` 生成。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 00:00_
