# What

- 为 `signal-trader` 落地资金账户与交易账户之间的真实转账闭环：core 暴露 `funding_account` / `trading_account` projection，app/runtime 接入 transfer 编排，live 走真实 `transfer_order`，paper 走 mock transfer。
- 保持既有边界不变：不改 `apps/transfer-controller/**` 与 `libraries/transfer/**` 协议，不把 transfer ack 写回 core 事件真相。
- 为消除跨 runtime 误复用 active transfer 的风险，给 `transfer_order` 增加 `runtime_id` 隔离列与索引。

# Why

- 之前 `signal-trader` 只有预算 projection，没有真实资金搬运链路；live 可能逻辑上允许下单，但真实 trading 账户余额不足。
- 用户已经明确要求“要有真实转账”，且接口风格要类似 `submitOrder` 的可配置执行能力，因此这次需要把 transfer 真正接进 runtime 主链。
- 这次方案优先复用仓库现有 transfer 基础设施，尽量用最小改动补齐 live/paper 可运行闭环与审计能力。

# How

- 在 `libraries/signal-trader` 的 `SubscriptionState` 上补最小 capital 字段，沿用原有 `subscription` query 暴露 projection，不新增新的 query 面。
- 在 `apps/signal-trader` 增加 transfer config / venue typing，并把 `pre-order transfer-in` 与 `observer transfer-out` 接到 runtime worker；transfer 失败统一 fail-close 到 `audit_only`。
- 在 env bootstrap/live venue 中实现 trading balance 查询、active transfer 去重、transfer submit/poll；测试覆盖 paper mock、live happy path、currency mismatch、active transfer conflict。

# Testing

- 详见 `/.legion/tasks/signal-trader-funding-transfer/docs/test-report.md`
- 已通过：
  - `npm run build`（`libraries/signal-trader`）
  - `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`
  - `npm run build`（`apps/signal-trader`）
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
- 已知 warning：`@yuants/app-signal-trader` 存在 Jest worker 未优雅退出 warning，但断言与构建结果通过。

# Risk / Rollback

- 风险集中在 live 真实资金划转：余额口径偏差、observer sweep 抖动、外部 transfer controller 卡住后的 timeout 收口。
- 当前保护包括：`runtime_id` 隔离、currency mismatch fail-close、active transfer conflict 拒绝、transfer 异常锁到 `audit_only`。
- 回滚最快方式是移除 `runtime.metadata.signal_trader_transfer` 或直接 disable 对应 runtime；SQL 变更仅为兼容列与索引，可保留审计数据后回滚代码/配置。

# Links

- plan: `/.legion/tasks/signal-trader-funding-transfer/plan.md`
- rfc: `/.legion/tasks/signal-trader-funding-transfer/docs/rfc.md`
- review-rfc: `/.legion/tasks/signal-trader-funding-transfer/docs/review-rfc.md`
- review-code: `/.legion/tasks/signal-trader-funding-transfer/docs/review-code.md`
- review-security: `/.legion/tasks/signal-trader-funding-transfer/docs/review-security.md`
- walkthrough: `/.legion/tasks/signal-trader-funding-transfer/docs/report-walkthrough.md`
