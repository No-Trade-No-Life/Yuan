# signal-trader-formal-quote-source - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点当前 MidPriceCaptured 证据链、SQL quote 表结构与 app/runtime 的最小接入点。 | 验收: plan.md 明确问题定义、quote 读取方案、core/app 边界与风险边界；RFC 说明正式价格源设计。
- [x] 完成 task-local RFC 并做设计审查，收敛命令扩展、quote provider 与回退策略。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 app 层接入 SQL quote 读取，并将正式价格证据传入 core internal netting 主链。 | 验收: MidPriceCaptured 正式使用 quote 表价格证据；非正式 `entry_price` 仅保留为 sizing/输入，不再作为正式 netting 价格真相。
- [x] 补齐相关测试，覆盖 quote 命中、quote 缺失、library/app 回归路径。 | 验收: library/app 测试稳定覆盖正式价格源逻辑。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行 targeted build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录 quote-source 相关 build/test 结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 15:29_
