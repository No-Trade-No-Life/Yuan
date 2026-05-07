# signal-trader-capital-system-completion 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. reconciliation 的核心安全 blocker 已收敛：现在通过 `getProjectedBalanceForAccount(...)` 按 `account_id / reserve_account_ref` 计算 projected balance，避免把全局资金误当作单账户结论。
2. 新 query 面的默认暴露问题已收敛：`createSignalTraderServicePolicyFromEnv()` 现在默认不开放匿名读，只有显式 `SIGNAL_TRADER_ALLOW_ANONYMOUS_READ=1` 才放开。
3. `profit_target_reached` 已降级为 account-scoped advisory alert，并在 message 中明确 `advisory_scope=account`，不再伪装成 investor/subscription 级强事实。
4. internal netting 仍保持完整事件链 `MidPriceCaptured` + `InternalNettingSettled`，没有新增“无痕状态迁移”问题。

## Nits

1. 若部署侧显式开启匿名读，新增加的 `investor` / `signal` / `reconciliation` 查询仍会返回较敏感的资本聚合信息；风险已从“默认暴露”降为“配置风险”。
2. `MidPriceCaptured` 首版仍使用 `submit_signal.entry_price` 作为最小证据来源；它可审计，但不代表强市场中价真相。
3. tolerance 本身不会静默吞掉真实 mismatch，但它依赖 `reserve_account_ref` / account scope 的正确配置；错误配置仍可能导致解释偏差。
