# signal-trader-funding-transfer 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. `transfer_order` 现在写入并按 `runtime_id` 过滤 active transfer，跨 runtime 误复用别人的 transfer 状态这一核心 blocker 已基本收敛。
2. `pre-order transfer-in` 仍然必须先转账再下单；`TRANSFER_TIMEOUT` / `TRANSFER_ERROR` / `TRANSFER_CURRENCY_MISMATCH` 都会 fail-close，不存在明显的“timeout 后继续下单”路径。
3. `runtime.metadata.signal_trader_transfer` 的基础防呆已补齐：拒绝空 funding account、空 currency、以及 `funding_account_id === runtime.account_id`，并在 transfer 前校验币种一致性。

## Nits

1. secure-by-default 仍偏保守不足：默认 `allowAnonymousRead` 仍开启，且只要环境变量显式打开 `SIGNAL_TRADER_ASSUME_INTERNAL_TRUSTED=1`，就会信任所有写/运维请求；这更像部署面风险，而不是当前代码 blocker。
2. observer sweep 的放大风险总体已可接受，但仍依赖外部 `transfer_controller` 按时推进状态；如果 controller 卡住，runtime 会按 `TRANSFER_TIMEOUT` fail-close。
3. 若未来继续加强安全边界，优先方向应是：
   - 为 mutating/operator services 提供更细粒度授权
   - 补 timeout / poll error / active-transfer-conflict 的监控聚合
