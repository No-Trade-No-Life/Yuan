# signal-trader-capital-system-completion - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点当前资本系统已实现与未实现部分，并给出剩余缺口的最小可行实现路径。 | 验收: plan.md 明确 gap list、范围、风险边界与验收标准；RFC 说明 buffer/netting/profit target/projection/reconciliation 的落点。
- [x] 完成 task-local RFC 并做设计审查，收敛剩余功能的实现顺序与边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 core/app 中补齐资本系统剩余核心能力，并保持与现有 daily burn/transfer 实现兼容。 | 验收: buffer/netting/profit target/projection/reconciliation 至少达到任务 plan 约定的最小闭环。
- [x] 补齐相关测试，覆盖新增 happy path 与关键 fail path。 | 验收: library/app 测试能稳定覆盖新增资本系统功能。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行 targeted build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录核心验证结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 14:33_
