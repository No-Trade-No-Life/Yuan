## What

- 将 `signal-trader` internal netting 的正式价格证据从 `submit_signal.entry_price` 切换到 SQL `QUOTE` 表。
- app 层新增/接入 quote provider，在 submit path 中注入 formal reference evidence；core 仅消费显式注入的 `reference_price*`，不再直接把输入价格当作 netting 真相。
- 同步补齐 core/app 测试、RFC/code/security review 与交付 walkthrough，保证这次切换可验证、可审计、可 review。

## Why

- 现状把 `entry_price` 同时当作 sizing 输入和正式价格证据，审计语义是脏的，后续 PnL、资本归因和排障都缺少统一真相源。
- 仓库已经有标准 SQL `QUOTE` 表，但 signal-trader 之前没有把它接入正式事件链；这次改动就是把“正式价格源”收口到系统内可追溯证据。
- quote 缺失时继续回退到 `entry_price` 会让“切换正式价格源”失去意义，因此本次明确采用 fail-close。

## How

- 在 `apps/signal-trader` 中通过 SQL `QUOTE` provider 读取并规范化最新价格证据；未指定 datasource 且存在多来源时返回 `QUOTE_AMBIGUOUS_DATASOURCE`，不做 latest-wins。
- 在 `libraries/signal-trader` 中扩展 `SubmitSignalCommand` / `MidPriceCaptured`，让 `reference_price`、source、datasource、quote 时间进入事件流，并要求 formal evidence 完整时才允许 internal netting。
- `RuntimeWorker` 清洗外部 `reference_price*` 输入，只信任 provider 覆盖值；`reference_price*` 不进入 idempotency fingerprint，避免重试被 quote 时间戳干扰。

## Testing

- 见测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/test-report.md`
- 已验证：`libraries/signal-trader` build 通过且 `lib/index.test.js` 26 passed；Rush 下 `@yuants/signal-trader` 与 `@yuants/app-signal-trader` 联合构建通过。
- 已覆盖：quote 命中路径、quote 缺失 fail-close、datasource 歧义 fail-close、provider 映射、idempotency 回归。
- 已知 warning：Node/Rush 与 TypeScript 版本提示、`@yuants/app-signal-trader` Jest worker teardown warning；不阻断本次交付。

## Risk / Rollback

- 风险：切换后 internal netting 会比以前更保守；quote 缺失、歧义或旧 quote 会直接阻止正式结算，而不是继续沿用输入价格。
- 风险：当前仍无 freshness/staleness gate，旧但合法的 quote 仍可能成为正式证据。
- 回滚：优先回滚 app 层 quote provider 注入与 core 对 `reference_price` 的依赖判定；不建议用运行时回退到 `entry_price` 充当正式真相。

## Links

- Plan: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/plan.md`
- RFC: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/rfc.md`
- RFC Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-rfc.md`
- Code Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-code.md`
- Security Review: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-security.md`
- Walkthrough: `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/report-walkthrough.md`
