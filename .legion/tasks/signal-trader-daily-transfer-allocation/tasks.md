# signal-trader-daily-transfer-allocation - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 梳理当前 daily burn、logical accounts 与 transfer runtime 的实现偏差，明确新的日拨资金模型。 | 验收: plan.md 明确问题定义、scope、风险与验收标准；RFC 收敛新账户语义与 transfer 调度。
- [x] 完成 task-local RFC 并做设计审查，收敛 daily tranche、funding/trading 定义、runtime tick 与回滚边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 在 core/app 中实现新的 daily transfer allocation 语义，并让 live/paper 都在不下单时按天完成划拨。 | 验收: `daily_burn_amount` 真正驱动 funding->trading 的固定日拨，logical account 与 runtime transfer 行为一致。
- [x] 补齐相关测试与前端同步，覆盖 D+1、无下单日拨、transfer-out excess、paper time control 场景。 | 验收: library/app/frontend 至少有最小回归覆盖。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行 targeted build/test/manual verify，并生成测试报告。 | 验收: `docs/test-report.md` 记录新的资金语义验证结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 21:11_
