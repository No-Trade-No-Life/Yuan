# signal-trader-daily-burn-budget 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-22

## 关键结论

1. `over-reserved` 的两个 blocker 已关闭：
   - `dispatch-command` 现在有显式 no-expansion guard，避免 release 未追平时继续同向放大仓位。
   - `RuntimeWorker.queryProjection()` 改为局部复制 state，不再污染共享 `clock_ms`。
2. `submitSignal -> executeEffects -> appendCommand` 现在显式复用同一次提交采样到的 `now_ms`，同链路时钟一致性比之前更明确。
3. budget helper 已收口到 core，`reducer / dispatch / query / reconciliation` 共用同一套语义；`index.ts` 也不再把 helper 作为公共 API 导出。

## Nits

1. 当前 `over-reserved` guard 以“目标仓位数量是否放大”为主，而不是直接比较“风险金额是否放大”；在现有止损不可变约束下足够，但长期看仍可再收口成更直接的 risk guard。
2. `refreshSnapshotBudget()` 仍把同一个 `projected_balance` 写回所有 reconciliation account；按当前单账户模型可接受，但如果未来引入多 account / reserve account，需要优先拆分这里的口径。
3. 可以再补一条更直接的回归：显式断言 `over-reserved` 时同向输入被拒绝，而不是仅验证“不隐式缩仓”。
