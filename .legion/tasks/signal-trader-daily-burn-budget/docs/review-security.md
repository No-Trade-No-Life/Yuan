# signal-trader-daily-burn-budget 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-22

## 关键结论

1. budget release 主链已经收口到 core helper，`released_vc_total` 有非负/上限钳制，没有看到会把 live 风险敞口放大到 `vc_budget` 之外的新路径。
2. query 仍然是只读 lazy-evaluate，不写事件流、数据库或 checkpoint；本次改动没有把 query 变成隐性写路径。
3. 本次 scope 内没有新增凭证处理、鉴权放宽、危险写接口或硬编码 secret，高风险面主要仍是预算/时间语义本身。

## Nits

1. reconciliation 目前使用执行时 `now_ms` 做 budget 补算，而不是严格绑定 `account_snapshot.updated_at/captured_at`；跨日边界时仍可能触发偏 fail-close 的误锁，这更像 DoS/误拒绝风险，而不是资金直接暴露。
2. `now_ms` 已做有限数校验，但 `effective_at` 与历史 snapshot 数值仍依赖上游数据正确性；异常值更可能造成 replay/运行失败或错误拒绝，而不是静默放大风险。
3. 用户已明确允许本轮安全强度弱化，因此这些问题暂不构成 blocker；若后续继续收口 live 预算边界，应优先统一“观察快照时间”与“预算求值时间”的口径。
