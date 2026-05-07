# signal-trader-daily-transfer-allocation RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. `funding_account` / `trading_account` / `available_vc` 语义已经重新收口，不再沿用“未占用风险 / 已占用风险”的旧混合语义。
2. `target_trading_balance` 已明确提升为包含 over-reserved 下限与 precision lock 的目标，不再把这部分资金当成 excess。
3. live / paper 的“不下单日拨资”入口已明确写入 `boot / observer / paper clock / submit`。
4. 旧 snapshot compatibility 已考虑 precision lock fallback，避免历史状态被系统性低估。

## 保留的 nits

1. 首次 live observer 阶段的 `transfer-in` 仍依赖 fresh balance 查询而不是 matched reconciliation；这是业务目标与更保守资金门禁之间的折中。
2. 当前 excess sweep 策略刻意保持简单：超出 `target_trading_balance` 的余额默认可回 funding，后续若要细分盈利/人工补款来源，需要另开 capital ledger 任务。
