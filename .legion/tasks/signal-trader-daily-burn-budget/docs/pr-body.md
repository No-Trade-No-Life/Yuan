# What

补齐 `signal-trader` 中 `daily_burn_amount` 的按天 lazy-evaluate 预算释放语义，让 `libraries/signal-trader` 与 `apps/signal-trader` 在 paper / live 路径上共用同一套 budget refresh 规则。此次改动覆盖 core budget helper、dispatch/query/reconciliation 主链，以及 app 层单次调用时钟收口。

# Why

根 RFC 已冻结 daily burn 语义，但此前实现仍停留在字段接线阶段：sizing 继续吃静态 `vc_budget`，query 不会跨天补算预算，reconciliation 口径也未与 lazy-evaluate 对齐。结果是 paper/live 无法稳定复现 D+1 / D+2 预算释放，RFC 与真实行为持续漂移。

# How

- 在 `libraries/signal-trader` 新增统一 budget helper，集中处理首日 tranche、D+N lazy release、`available_vc` 与 `sizing_vc_budget`。
- `dispatch-command`、`query-projection`、reconciliation 都改为先按 `state.clock_ms` 做 snapshot budget refresh，再读预算相关字段；`over-reserved` 场景下显式阻止同向扩张。
- `apps/signal-trader` 的 runtime worker / manager 改为单次调用只采样一次 `now_ms` 并全链路复用，补齐 paper/live 跨天预算回归测试。

# Testing

- 见 `/.legion/tasks/signal-trader-daily-burn-budget/docs/test-report.md`
- 已通过：
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
  - `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
  - `npm run build`（`libraries/signal-trader`）
  - `npm run build`（`apps/signal-trader`）
- 备注：`@yuants/app-signal-trader` 仍有既有 Jest worker 未优雅退出 warning，不阻断本次功能结论。

# Risk / Rollback

- 风险主要集中在 budget 派生字段再次混用、`over-reserved` guard 长期语义不够直接，以及 reconciliation 使用执行时 `now_ms` 可能在跨日边界偏 fail-close。
- 本次无 schema / event format 变更，回滚时直接回退实现代码即可恢复旧的静态 `vc_budget` 行为。

# Links

- Plan: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/plan.md`
- RFC: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/rfc.md`
- RFC Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/review-rfc.md`
- Code Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/review-code.md`
- Security Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/review-security.md`
- Walkthrough: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/report-walkthrough.md`
