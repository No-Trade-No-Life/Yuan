# signal-trader-funding-transfer RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. **core / app 边界**
   - RFC 已把 `trading_buffer_amount`、`projected_total_required_balance`、diagnostics 留在 app helper，core 只保留最小 capital 字段。
   - transfer ack 仍不进入 domain 真相。
2. **stale snapshot / 重复补资**
   - pre-order 已改为 `queryTradingBalance()` 取最新余额，不再依赖旧 observer snapshot。
   - 幂等策略改成“单 runtime 单 active transfer + 终态后重算缺口”，不再强绑固定金额。
3. **observer transfer-out 可执行性**
   - 已补 fresh snapshot、无 active order、无 active transfer、transfer 完成后等待新 snapshot、双观察门槛等条件，抑制 sweep 抖动。
4. **幂等冲突策略过硬**
   - 已删除“同 key 不同金额直接 fail-close”的僵硬规则，改为复用 active transfer 并在终态后重算缺口。

## 保留的 nits

1. RFC 已冻结“不新增 query type”，实现时不要再把 core query 面顺手扩大成新的 `capital_accounts` 查询。
2. live trading balance 的最终字段口径（沿用 `balance` 还是细化为 vendor-specific 可用余额）本轮先按既有 `balance` 落地，但后续若有 venue 偏差仍需再收口。

## 审查摘要

- 当前 RFC 已达到可编码状态，可以进入实现阶段。
- 实现时优先保证三件事：
  - transfer venue 负责 dedupe / poll，runtime 不直接写 SQL
  - pre-order transfer-in 与 observer transfer-out 分开收口
  - 运行时任何 transfer 失败都要有明确 audit 与 fail-close 语义
