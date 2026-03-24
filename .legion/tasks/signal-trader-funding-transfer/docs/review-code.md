# signal-trader-funding-transfer 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. 之前的 blocker 已关闭：
   - shared trading account 冲突现在会在 live transfer runtime 准入阶段直接拒绝。
   - currency mismatch 在 pre-order / observer / paper sweep 路径都显式 fail-close。
2. core funding/trading projection 仍与 budget helper 一致，`funding_account = available_vc`、`trading_account = reserved/current_required` 没有出现新的语义漂移。
3. transfer venue / runtime worker 的职责边界更清楚：venue 返回结构化 trading balance 与 transfer submit/poll，runtime 负责策略判断、去重和锁态收口。

## Nits

1. shared account 的修复策略是“禁止复用”而不是账户级聚合调度，安全但更保守；如果未来确实要多 runtime 共用账户，需要单独做更完整的账户级 planner。
2. timeout / poll error 的负向用例仍然偏少，当前测试以 happy path、currency mismatch 和 account conflict 为主。
3. app build 仍有 Jest worker 未优雅退出 warning，说明测试清理还有尾巴，但不阻断本次功能结论。
