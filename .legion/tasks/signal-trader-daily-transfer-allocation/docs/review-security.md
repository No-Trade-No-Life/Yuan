# signal-trader-daily-transfer-allocation 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. 重复补资风险已明显收敛：live observer 使用 `queryTradingBalance()` 作为真实余额基准，并以 `transferInCooldownSnapshotUpdatedAt` 防止同一 snapshot 重复补资。
2. 错误 sweep 风险已缓解：`transfer-out` 以 `getTradingCapitalTarget()` 为下限，且仍保留“无在途订单 + 连续两轮 observer”保护，不再把已分配本金误扫回 funding。
3. 新逻辑没有新增新的对外高风险写 API；仍复用既有 transfer controller / runtime write 路径。
4. paper clock 仍只影响 paper；本轮 daily allocation 变化没有把测试能力污染到 live 主路径。

## Nits

1. live 首次 observer 阶段的 `transfer-in` 仍然允许在 fresh matched reconciliation 之前发生；这是为了满足“无论下单与否都要日拨资”的业务目标而保留的折中，后续若要更稳，可再细化为“transfer-in 允许、transfer-out 更严格”。
2. excess sweep 目前默认把高于目标池的盈利/人工补款等都视为可回收 excess；如果以后要细分来源，需要更完整的 capital ledger。
3. 现有 app 测试仍有 teardown warning，虽然不影响资金语义，但会削弱长期回归信号质量。
