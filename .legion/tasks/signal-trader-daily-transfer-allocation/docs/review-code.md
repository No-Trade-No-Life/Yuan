# signal-trader-daily-transfer-allocation 代码审查

## 结论

- Verdict: `PASS`
- 审查日期：2026-03-23

## 关键结论

1. 新的 `funding_account` / `trading_account` / `available_vc` 语义已经自洽：`funding` 表示未拨资本、`trading` 表示已拨资本池、`available` 表示仍可继续扩张的容量。
2. `getTradingCapitalTarget()` 统一了 runtime 侧 target 公式，over-reserved 不会再把维持现有仓位所需资金误 sweep 回 funding。
3. live / paper 的“不下单也按日拨资”主目标已经达成：paper boot + paper clock + submit 会补资，live boot/observer 周期也会补资。
4. 旧 snapshot compatibility 已补齐：`inferReleasedVcTotal()` 现在会把 `precision_locked_amount` 计回 legacy release，历史状态仍可解释。

## Nits

1. `apps/signal-trader` 单包 `npm run build` 需要在 library 构建完成后顺序执行；并行执行时会被 library clean 临时打断模块解析。
2. 目前文档和 UI 已经同步到“projected funding/trading”语义，但后续若继续扩资本系统，仍建议把 operator 文案再打磨得更明确。
3. `@yuants/app-signal-trader` 的 Jest worker 未优雅退出 warning 仍在，说明测试 teardown 还有尾巴。
