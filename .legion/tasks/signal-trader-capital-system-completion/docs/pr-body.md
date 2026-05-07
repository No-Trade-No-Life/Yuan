# What

本 PR 补齐 `signal-trader` 资本系统剩余核心闭环，覆盖 `precision_lock` 驱动的 investor buffer、`MidPriceCaptured` / `InternalNettingSettled` internal netting 事件链、account-scoped `profit_target_reached` advisory alert，以及 `investor` / `signal` / `reconciliation` 只读查询面。

同时把 reconciliation 从粗粒度单标量比对升级为 account-scoped + tolerance/explanation 模式，并把匿名只读从默认开放收紧为显式配置开启。

# Why

之前资本系统已经能跑，但仍存在多个“有字段/有 event type、却没有真实语义”的缺口，导致 buffer、内部权益迁移、利润目标、聚合查询和对账解释都不完整。

本次实现的目标不是一步做成 full capital ledger，而是在当前事件溯源模型下补齐最小可解释闭环，让 replay、query、审计与运行时行为重新对齐。

# How

- 在 `libraries/signal-trader` 内统一 budget/buffer/reconciliation 计算，并将 `precision_lock` 聚合到 investor buffer。
- 在 `submit_signal` 路径追加保守门禁的 internal netting 触发，在 `capture_authorized_account_snapshot` 路径追加 account-scoped profit target advisory alert。
- 在 query 层新增 `investor` / `signal` / `reconciliation` 投影，并在 `apps/signal-trader` 收紧匿名读默认策略与补充配套测试。

# Testing

- 见 `/.legion/tasks/signal-trader-capital-system-completion/docs/test-report.md`
- 已验证：
  - `npm run build`（`libraries/signal-trader`）通过，`lib/index.test.js` 24 passed
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader` 通过
  - `npm run build`（`apps/signal-trader`）通过，app 测试 45 passed
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader` 通过
- 已知 warning：`@yuants/app-signal-trader` 仍有 Jest worker teardown warning，但不阻断本次交付

# Risk / Rollback

- 风险：`MidPriceCaptured` 首版仍依赖 `submit_signal.entry_price`；`profit_target_reached` 仍是 advisory；若显式开启匿名读，新 query 会暴露较敏感的资本聚合信息。
- 回滚：可分别关闭 internal netting 触发、恢复旧 reconciliation 判定，或继续保持匿名读默认关闭；回滚优先关闭新增派生语义，不删除历史事件。

# Links

- Plan: `/.legion/tasks/signal-trader-capital-system-completion/plan.md`
- RFC: `/.legion/tasks/signal-trader-capital-system-completion/docs/rfc.md`
- RFC Review: `/.legion/tasks/signal-trader-capital-system-completion/docs/review-rfc.md`
- Code Review: `/.legion/tasks/signal-trader-capital-system-completion/docs/review-code.md`
- Security Review: `/.legion/tasks/signal-trader-capital-system-completion/docs/review-security.md`
- Walkthrough: `/.legion/tasks/signal-trader-capital-system-completion/docs/report-walkthrough.md`
