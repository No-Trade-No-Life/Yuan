# signal-trader-capital-system-completion 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. 之前的 blocker 已关闭：
   - `refreshSnapshotBudget` 现在会同步重建 `investor_buffers`，时间推进后的 `precision_lock` / buffer 快照保持自洽。
   - `sources[].event_id` 不再被任意后续事件覆盖，而是来自 subscription 上稳定保存的 `precision_lock_source_event_id`。
2. internal netting 门禁明显收紧：现在要求“本次 submit 至少引入两条相反方向 target 变化”，避免历史残留偏差被 no-op submit 误结算。
3. profit target advisory 的账户绑定已经修正：runtime canonical subscription 现在绑定 `runtime.account_id`，transfer 配置不再误污染 `reserve_account_ref`。
4. reconciliation tolerance 仍保持保守，且 projected balance 已按 account scope 计算，不再轻易把别的账户资本混进当前账户结论。

## Nits

1. `MidPriceCaptured` 仍依赖 `submit_signal.entry_price` 作为首版证据来源，后续若要做更强的 realized/unrealized 资本系统，还需要更正式的价格源。
2. `InvestorProjection` / `SignalProjection` 目前是最小 query-time 聚合；如果未来上层强依赖这些返回结构，最好再补更明确的 API 契约说明。
3. `@yuants/app-signal-trader` 的 Jest worker 未优雅退出 warning 仍在，说明测试清理还有尾巴，但不阻断本次交付。
