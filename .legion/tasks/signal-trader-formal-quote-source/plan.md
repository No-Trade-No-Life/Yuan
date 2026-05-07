# signal-trader-formal-quote-source

## 目标

把 signal-trader 的正式价格证据源切到 SQL `quote` 表，替代当前 internal netting 对 `submit_signal.entry_price` 的最低配依赖，并交付完整 Legion 文档。

## 问题定义

- 当前 `MidPriceCaptured` 仍然直接使用 `submit_signal.entry_price` 作为 internal netting 的价格证据。这最多只能算“输入附带价格”，不是正式、可追溯、可独立验证的价格真相。
- 仓库已经有标准 SQL `QUOTE` 表与 `quote.sql` 结构，可作为统一价格源；但 signal-trader 目前既没有读取它，也没有把 quote 证据传进 core 事件链。
- 如果继续沿用 `entry_price`，后续做更强的 realized/unrealized PnL、资本归因或审计时，都会被“价格证据来自 submit payload”这一点卡住。

## 验收标准

- internal netting 的正式价格证据来自 SQL `QUOTE` 表，而不是 `submit_signal.entry_price`。
- app 层提供最小 quote provider，从 SQL `QUOTE` 表读取某 product 的最新价格证据，并把结果传入 core。
- core command / event 链路支持显式承载 quote-based 价格证据，至少包含：
  - `reference_price` 或等价字段
  - `reference_price_source`
  - 必要时的 `datasource_id` / `quote_updated_at`
- `MidPriceCaptured` 使用 quote provider 返回的正式价格证据；当 quote 缺失时，internal netting fail-close，不再静默回退到 `entry_price` 作为正式真相。
- `entry_price` 仍保留给 sizing / 输入语义，不被删除；但它不再充当正式 netting 价格证据。
- 新增测试至少覆盖：
  - quote 命中时，internal netting 生成 `MidPriceCaptured`
  - quote 缺失时，internal netting 不触发
  - app 层 SQL quote provider 的读取与映射
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- `QUOTE` 表结构以 `tools/sql-migration/sql/quote.sql` 为准，不新增 quote schema。
- 正式价格首版采用“最近一条 quote 行”的最小策略：
  - 优先 `(bid_price + ask_price) / 2`
  - 否则回退 `last_price`
- 首版 quote provider 由 app 层通过 SQL 读取实现；core 只消费已经规范化后的价格证据，不直接触 SQL。
- 不要求这轮把价格源扩展为多 datasource 仲裁器；同一 product 先取最新 quote 行即可。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-formal-quote-source/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 不新增 SQL schema，不改 `tools/sql-migration/sql/quote.sql`。
- 不把 quote SQL 访问塞进 core library；正式价格源必须由 app 注入到 core。
- 不重做 transfer / daily burn / capital reconciliation 主链；本轮只替换 internal netting 的正式价格证据来源。

## 风险分级

- **等级**：Medium
- **标签**：`continue` `quote` `pricing`
- **理由**：该改动不会新增资金写路径，但会改变 internal netting 的正式价格证据真相，影响事件流审计与后续 PnL 解释，因此仍需 task-local RFC 与 review 收敛。

## 要点

- SQL `QUOTE` 表是正式价格源
- core 不直连 SQL，app 注入 quote provider
- `entry_price` 留给 sizing，不再兼任正式 netting 证据
- quote 缺失时 internal netting fail-close，而不是偷偷回退

## 范围

- `.legion/tasks/signal-trader-formal-quote-source/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `.legion/playbook.md`

## Design Index

- quote 表结构：`/Users/c1/Work/signal-trader/tools/sql-migration/sql/quote.sql`
- data-quote helper：`/Users/c1/Work/signal-trader/libraries/data-quote/src/helper.ts`
- capital 补完任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-capital-system-completion/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/docs/rfc.md`

## 最小实现边界

- 包含：quote provider、command 扩展、MidPriceCaptured 正式价格切换、测试与文档。
- 暂不包含：多 datasource 仲裁、市场数据缓存层、全局 quote freshness 策略、quote schema 修改。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 15:08_
