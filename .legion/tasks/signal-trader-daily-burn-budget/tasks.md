# signal-trader-daily-burn-budget - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 确认当前 RFC、core library 与 app runtime 中 daily burn / available_vc / last_budget_eval_at 的现状与缺口。 | 验收: plan.md 明确问题定义、风险与最小改动边界；RFC 说明 lazy-evaluate 在 core/query/app 中的落点。
- [x] 完成 task-local RFC 并做设计审查，收敛 paper/live 共用语义、时间控制方案与对账影响。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 明确可执行方案与回滚边界。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 core library 中实现按天释放 VC 的 lazy-evaluate，并让 dispatch/query/reconciliation 统一消费该语义。 | 验收: `daily_burn_amount` 真正影响 `available_vc`、sizing 与 projected balance；replay / query 保持一致。
- [x] 在 app runtime / manager 中接入时间推进与验证入口，补齐 paper/live 相关测试。 | 验收: app 层在 paper/live 测试中都能验证跨天释放 VC，且不引入 paper/live 语义分叉。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行 targeted build/test，并生成测试报告。 | 验收: `docs/test-report.md` 记录 core + app 的验证结果，至少覆盖 library 与 app-signal-trader。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-22 15:25_
