# signal-trader-funding-transfer - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点现有 signal-trader 预算/执行链、transferController、ITransferOrder、transfer 请求接口与 root RFC 中资金账户语义。 | 验收: plan.md 明确问题定义、可复用接口、scope 边界与主要风险；RFC 说明 transfer 模型与编排路径。
- [x] 完成 task-local RFC 并做设计审查，收敛 transfer 触发条件、live/paper 适配、状态机与最小持久化策略。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可实现状态，明确回滚方式。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 core/app 中实现 funding/trading transfer 语义、配置化 transfer 接口与 paper/live 执行编排。 | 验收: signal-trader 能在需要时发起 transfer，并通过统一接口消费 transfer 结果，不影响既有 submitOrder 路径。
- [x] 补齐 transfer 相关测试与本地最小运行入口。 | 验收: paper/live 至少各有一条转账相关回归测试，能验证成功与关键失败路径。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行 targeted build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录 transfer 相关 build/test 结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 13:18_
