# signal-trader-funding-transfer

## 目标

为 signal-trader 落地资金账户与交易账户之间的真实转账能力，接入类似 `submitOrder` 的可配置 transfer 接口，并交付完整 Legion 文档。

## 问题定义

- 当前 signal-trader 只有“预算 projection”，没有真实的资金账户 / 交易账户转账执行链；`daily_burn_amount` 只会改变账面预算，不会驱动 `funding_account -> trading_account` 或反向归集。
- 仓库里已经有成熟的 transfer 基础设施：
  - `ITransferOrder`
  - `transfer_order` 表
  - `apps/transfer-controller`
  - vendor 侧 `TransferApply / TransferEval`
    但 signal-trader 还没有把这些能力接入自己的 runtime / live execution 路径。
- 用户已经明确要求“要有真实转账”，并要求依赖一个类似 `submitOrder` 的可配置接口，因此这次不能只补文档或 projection，必须把可运行的 transfer 编排真正接入。

## 验收标准

- signal-trader 支持真实 funding/trading transfer：
  - live 模式下，在需要时能创建 `ITransferOrder` 并依赖 `transferController` 跑到终态
  - paper 模式下有 mock transfer 路径，不因缺少真实 transfer controller 而阻塞测试
- `apps/signal-trader` 提供类似 `submitOrder` 的可配置 transfer 接口，而不是把 SQL / polling 逻辑硬编码在 runtime 主流程里。
- runtime 在 live 下至少覆盖两类转账：
  - 下单前资金不足时，`funding_account -> trading_account`
  - 持仓/风险下降且无活跃订单时，`trading_account -> funding_account`
- core/query 至少能暴露逻辑 `funding_account` / `trading_account` 视图，供 runtime 决策和调试使用。
- 新增测试至少覆盖：
  - paper：mock transfer 触发与回收
  - live：pre-order transfer in、post-fill transfer out、transfer 失败收口
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 本轮优先复用现有 `transfer_order` + `apps/transfer-controller` 路径；若 runtime 隔离无法闭环，允许仅在 `transfer_order` 上追加最小 `runtime_id` 列。
- runtime 级 transfer 配置通过 `SignalTraderRuntimeConfig.metadata` 携带，不额外扩表；最小字段为：
  - `funding_account_id`
  - `currency`
  - 可选 `min_transfer_amount`
- `runtime.account_id` 继续代表交易账户；`metadata.signal_trader_transfer.funding_account_id` 代表资金账户。
- 真实 transfer 仍不进入 core 事件真相；core 只提供 `funding_account` / `trading_account` projection，真实 transfer 由 app/runtime 执行。
- 用户已明确“安全考虑可以弱化”，因此本轮优先把功能闭环、paper/live 跑通与接口可配置补齐，不额外扩大复杂权限系统改造。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-funding-transfer/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `tools/sql-migration/sql/transfer_order.sql`（仅在为 transfer runtime 隔离追加最小 `runtime_id` 列时允许）
  - `.legion/playbook.md`
- 不修改 `apps/transfer-controller/**` 与 `libraries/transfer/**` 的协议行为，优先作为既有依赖使用。
- 不改 transfer controller 协议；仅允许在 `transfer_order` 表上做最小兼容列扩展。
- transfer 逻辑不能破坏既有 `submitOrder` 主链；当 runtime 未配置 transfer 元数据时，原行为保持兼容。

## 风险分级

- **等级**：High
- **标签**：`continue` `risk:high` `live` `transfer`
- **理由**：该改动会让 signal-trader 在 live 下发起真实资金划转，直接改变实盘资金流向；即使用户允许弱化安全考虑，也必须先把 transfer 触发边界、幂等、防重复转账与失败收口写清楚，再实现和测试。

## 要点

- 复用 `ITransferOrder` / `transfer_order` / `transferController`，不要自造第三套转账协议
- app 层提供可配置 transfer 接口，风格上贴近 `submitOrder`
- paper/live 都要有 transfer 路径：paper mock、live real
- 不把 transfer ack 写回 core 真相，而是在 app/runtime 做编排与审计

## 范围

- `.legion/tasks/signal-trader-funding-transfer/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `tools/sql-migration/sql/transfer_order.sql`
- `.legion/playbook.md`

## Design Index

- 根 RFC 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- transfer controller：`/Users/c1/Work/signal-trader/apps/transfer-controller/src/index.ts`
- transfer order 模型：`/Users/c1/Work/signal-trader/libraries/transfer/src/model/TransferOrder.ts`
- transfer 请求 helper：`/Users/c1/Work/signal-trader/libraries/transfer/src/request.ts`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-funding-transfer/docs/rfc.md`

## 最小实现边界

- 包含：core funding/trading projection 字段、app-level transfer port、live transfer order submit/poll、paper mock transfer、必要时 `transfer_order.runtime_id` 最小迁移、回归测试、任务级文档。
- 暂不包含：transfer controller 协议重写、跨 vendor 新增 transfer protocol、复杂多账户净额调度器。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 10:18_
