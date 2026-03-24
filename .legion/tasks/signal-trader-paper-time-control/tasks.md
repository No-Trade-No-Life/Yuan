# signal-trader-paper-time-control - 任务清单

## 快速恢复

**当前阶段**: 已完成
**当前任务**: (none)
**进度**: 6/6 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点 signal-trader 当前时间来源、paper bootstrap、runtime manager/worker 与最小时间注入点。 | 验收: plan.md 明确问题定义、scope、风险与验收标准；RFC 收敛 paper-only 时间控制方案。
- [x] 完成 task-local RFC 并做设计审查，明确时间偏移模型、服务接口/脚本入口与回滚边界。 | 验收: `docs/rfc.md` 与 `docs/review-rfc.md` 达到可编码状态。

---

## 阶段 2: 实现 ✅ COMPLETE

- [x] 实现 paper-only 时间偏移能力，并接入运行中的 paper stack。 | 验收: 运行中的 paper stack 能通过脚本或服务接口前进时间，且 query/submit/reconcile 共用该时间源。
- [x] 补齐最小验证脚本/测试，覆盖 D+1 推进行为。 | 验收: 至少能稳定验证推进 1 天后 budget/projection 行为发生变化。

---

## 阶段 3: 验证与交付 ✅ COMPLETE

- [x] 执行相关 build/test/manual verify，并生成测试报告。 | 验收: `docs/test-report.md` 记录验证方式与结果。
- [x] 完成代码评审/安全评审/交付报告与 PR body。 | 验收: 生成 `review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

---

## 发现的新任务

(暂无)

---

_最后更新: 2026-03-23 17:32_
