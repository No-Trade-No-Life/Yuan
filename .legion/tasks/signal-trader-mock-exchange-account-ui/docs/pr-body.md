# Summary

- 修复 `signal=0` forced-flat attribution：close fill 现在会按待结算缺口正确回写，平仓后 mock account 与 `QueryProjection(product)` 都会一致收敛到空仓。
- 将 `profit_target_value` 从 advisory-only 升级为 auto-flat + profile lifecycle close：命中阈值后自动提交 `signal=0`，仓位归零后把 `subscription_status` 收敛为 `closed`。
- 加固 runtime worker 写入边界：`flatten_requested` 期间拒绝新的外部 signal，外部伪造 `source='agent'` 会被降级为 `manual`。
- 前端 risk gate 现已在 `subscription_status !== active` 时禁用提交，和后端生命周期拒绝保持一致。

# Testing

- 详情见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`
- PASS：`libraries/signal-trader` `heft test --clean`，29/29 通过。
- PASS：app root TypeScript `--noEmit`。
- PASS：`apps/signal-trader` `heft build --clean`。
- PASS：`ui/signal-trader-web` `npm run build`。
- PASS：focused runtime verification script，覆盖 profit target auto-flat、空仓收敛、`subscription_status=closed` 与关闭后 submit reject。
- Notes：`apps/signal-trader` 全量 Heft test suite 在当前环境触发 OOM，因此本轮以以上验证组合作为最终结论。

# Risks or Notes

- 代码审查结论：`PASS-WITH-NITS`，见 `./.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-code.md`。
- 安全审查结论：`PASS-WITH-NITS`，见 `./.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md`。
- 已收敛的高风险点：外部伪造 `source='agent'` 不再保留 agent 写权限；自动平仓窗口会拒绝新的外部 signal。
- 剩余注意事项：`profit_target_value` 仍基于单次观测越阈值触发，`reconciliation mismatch` / 异常快照下是否应 auto-flat 仍建议后续补策略与测试。
- 回滚：可分别撤销 core forced-flat attribution / lifecycle 改动、runtime submit gate，以及前端 `subscription_status` risk gate；不涉及数据迁移。
