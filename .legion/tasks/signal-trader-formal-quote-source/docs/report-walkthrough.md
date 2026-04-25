# signal-trader-formal-quote-source 交付 walkthrough

## 目标与范围

- 目标：将 `signal-trader` internal netting 的正式价格证据从 `submit_signal.entry_price` 切换到 SQL `QUOTE` 表，并补齐实现、验证与评审交付物。
- 范围绑定本任务 scope：`libraries/signal-trader/**`、`apps/signal-trader/**`、`.legion/playbook.md`。
- 本轮实际落地重点集中在 `libraries/signal-trader` 与 `apps/signal-trader`；`.legion/playbook.md` 不作为本次实现主交付面。
- 不在本轮范围内：修改 `tools/sql-migration/sql/quote.sql`、引入多 datasource 仲裁器、重做 capital/transfer 主链。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/rfc.md`。
- 正式价格源唯一指向 SQL `QUOTE` 表；core 不直接触 SQL，由 app 层 quote provider 注入规范化后的 formal reference evidence。
- `entry_price` 保留给 sizing / 输入语义，不再兼任 internal netting 的正式价格真相。
- quote 缺失、非法或 datasource 歧义时采用 fail-close：不生成 `MidPriceCaptured`，也不静默回退到 `entry_price`。
- RFC 审查结论见 `review-rfc.md`，核心 blocker 已关闭，当前设计状态为可交付实现。

## 改动清单

### `libraries/signal-trader`

- 扩展 `SubmitSignalCommand` 的 formal reference evidence 字段，使 app 能显式把 `reference_price`、`reference_price_source`、`reference_price_datasource_id`、`reference_price_updated_at` 传入 core。
- 扩展 `MidPriceCaptured` 事件 payload，使正式价格证据在事件流中可追溯，而不是继续写成 `submit_signal.entry_price`。
- 调整 internal netting 判定逻辑：只有 formal reference evidence 完整时才生成 `MidPriceCaptured` / `InternalNettingSettled`。
- 收口幂等语义：`reference_price*` 不进入 fingerprint，避免同一 `signal_id` 因 quote 时间戳变化产生误判冲突。
- 补充 core 测试，覆盖 quote 命中、quote 缺失、evidence 不完整与 idempotency 回归路径。

### `apps/signal-trader`

- 新增/接入 SQL `QUOTE` provider，从 app 层读取正式价格证据并完成字符串到 number 的规范化映射。
- `RuntimeWorker` 在 submit path 中清洗外部 `reference_price*`，仅信任 provider 返回的 formal evidence，堵住外部伪造入口。
- 未配置 datasource 且同一 `product_id` 出现多 datasource 时，返回 `QUOTE_AMBIGUOUS_DATASOURCE` 并 fail-close，不再 latest-wins。
- quote 缺失或非法时记录 runtime audit log，使 fail-close 具备可观测性。
- 补充 app 测试，覆盖 bid/ask mid 映射与 datasource 歧义路径。

### 评审与文档

- RFC 审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-rfc.md`
- 代码审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-code.md`
- 安全审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/review-security.md`
- 测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/test-report.md`

## 如何验证

- 参考测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/test-report.md`
- 命令 1：`npm run build`（workdir=`libraries/signal-trader`）
  - 预期：`@yuants/signal-trader` build 通过，`lib/index.test.js` 26 passed，API Extractor 通过。
- 命令 2：`node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
  - 预期：Rush 下 `@yuants/signal-trader` 及依赖链构建通过。
- 命令 3：`node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
  - 预期：library + app 联合构建通过，app 侧 quote provider / bootstrap / runtime 测试一并通过。
- 行为验收点：
  - quote 命中且 formal evidence 完整时，internal netting 生成 `MidPriceCaptured`。
  - quote 缺失或 evidence 不完整时，即使存在 `entry_price`，也不生成 `MidPriceCaptured`。
  - 未显式指定 datasource 且存在多来源时，返回 `QUOTE_AMBIGUOUS_DATASOURCE` 并 fail-close。

## 风险与回滚

- 主要风险 1：quote 缺失、旧 quote 或 datasource 配置不清会让 internal netting 更保守，表现为不再结算而不是继续沿用输入价格。
- 主要风险 2：当前没有 freshness/staleness gate，旧但合法的 quote 仍可能成为正式证据；该风险已在安全审查中记录。
- 主要风险 3：`@yuants/app-signal-trader` 仍有 Jest worker 未优雅退出 warning，虽不阻断交付，但说明测试 teardown 仍有尾项。
- 回滚原则：优先回滚 app 层 provider 注入与 core 对 `reference_price` 的依赖判定；不建议以运行时偷偷回退到 `entry_price` 作为热修，因为这会直接破坏本任务的正式价格源约束。

## 未决项与下一步

- 未决项 1：是否需要引入 quote freshness/staleness gate；当前 RFC 明确暂不纳入本轮范围。
- 未决项 2：quote miss 的可观测性是否需要提升为 metric / health / submit response 级信号；当前仍主要依赖 audit log。
- 未决项 3：后续若接入更多 datasource，需继续收口 allowlist / venue 绑定与统一 evidence helper。
- 下一步建议：按本 PR 进行人类 review，重点检查 fail-close 语义、app/core 边界与 datasource 歧义处理是否符合 RFC。
