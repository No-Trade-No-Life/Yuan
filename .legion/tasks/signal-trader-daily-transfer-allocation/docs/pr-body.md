## What

- 本 PR 将 `signal-trader` 的 `daily_burn_amount` 语义切换为真实的每日固定拨资：funding account 每天向 trading account 分配 tranche，而不是仅在下单前按需补资。
- core projection、runtime transfer 调度与前端资金展示已一并同步到新语义，保证 live / paper 在无下单场景下也能完成日拨资金动作。

## Why

- 现有实现把 `daily_burn_amount` 做成“预算按天释放 + 下单前补资”，与业务目标不一致：不下单时不会真实划拨资金，funding / trading 语义也会误导使用者。
- 本次改动的目的，是把资金视图、运行态 transfer 和操作端展示统一成“未拨资本 / 已拨资本池 / 可继续扩张容量”的一致模型。

## How

- 在 `libraries/signal-trader` 中重做 budget projection：`funding_account` 表示未拨预算，`trading_account` 表示已拨资本池，`available_vc` 表示扣除 reserved 与 precision lock 后的可扩张空间。
- 在 `apps/signal-trader` 中统一 allocation sync：boot、observer、paper clock、submit 都会补齐当日 deficit；transfer-out 只回收真正 excess，不再扫回已分配本金。
- 在 `ui/signal-trader-web` 中同步 funding / trading 文案与展示解释，避免沿用旧心智模型。

## Testing

- 详见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/test-report.md`
- 已覆盖：core D0 / D1 / D2 新语义、paper/live 无下单日拨资、paper clock 推进、excess sweep、前端 paper e2e 冒烟。
- 结果：`PASS-WITH-WARNINGS`；当前仅剩工具链 warning 与 `@yuants/app-signal-trader` 测试 teardown warning。

## Risk / Rollback

- 风险：无下单日也会触发 transfer，observer 下 transfer 频率会上升；当前 excess 策略仍未区分盈利/人工补款来源。
- 回滚：切 `audit_only`/停 runtime，回退 projection 公式与 allocation sync 接线，重启 worker/replay 即可；本次无 schema 变更，无需数据迁移。

## Links

- Plan：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/plan.md`
- RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/rfc.md`
- RFC Review：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-rfc.md`
- Code Review：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-code.md`
- Security Review：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-security.md`
- Walkthrough：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/report-walkthrough.md`
