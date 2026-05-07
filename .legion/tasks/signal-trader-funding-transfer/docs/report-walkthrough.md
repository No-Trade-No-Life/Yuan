# signal-trader-funding-transfer 交付 walkthrough

## 目标与范围

- 本次交付围绕 `signal-trader-funding-transfer`，在不改动 `apps/transfer-controller/**` 与 `libraries/transfer/**` 协议行为的前提下，为 `signal-trader` 补齐资金账户与交易账户之间的真实转账闭环。
- 绑定 scope：`libraries/signal-trader/**`、`apps/signal-trader/**`、`tools/sql-migration/sql/transfer_order.sql`、`.legion/playbook.md`。
- 目标是把原先仅停留在预算 projection 的 `funding_account` / `trading_account` 语义，落到可运行的 app/runtime 编排中：live 真实转账、paper mock 转账、测试与审查材料齐备。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-funding-transfer/docs/rfc.md`。
- 采用方案是“复用既有 `transfer_order` + `apps/transfer-controller`，由 app/runtime 编排 transfer，core 仅暴露 logical funding/trading projection”。RFC review 结论为 `PASS-WITH-NITS`，见 `/.legion/tasks/signal-trader-funding-transfer/docs/review-rfc.md`。
- 关键设计点：
  - `SignalTraderRuntimeConfig.metadata.signal_trader_transfer` 作为唯一新增配置入口；未配置时保持旧行为兼容。
  - core 不写入 transfer ack 真相，仅暴露 `funding_account` / `trading_account` 供 runtime 决策。
  - live 路径在下单前执行 `pre-order transfer-in`，在 observer 空闲周期执行 `observer transfer-out`。
  - 为避免跨 runtime 误复用活动转账，`transfer_order` 增加最小 `runtime_id` 隔离列，并按 `runtime_id` + `status` 查询活跃单。

## 改动清单

### 1. core / projection

- `libraries/signal-trader/src/types/snapshot.ts`
  - 为 `SubscriptionState` 增加 `funding_account`、`trading_account` 字段，收口 logical capital 语义。
- `libraries/signal-trader/src/engine/query-projection.ts`
  - 沿用原有 `subscription` query 面，只返回扩展后的 subscription projection，没有额外扩大新的 query type。
- `libraries/signal-trader/src/index.test.ts`
  - 补充 funding/trading projection 与 daily burn 联动测试，验证 replay/query 语义保持稳定。

### 2. app 接口与 runtime 编排

- `apps/signal-trader/src/types.ts`
  - 新增 transfer config、transfer order、trading balance 等类型，并扩展 `LiveExecutionVenue` / adapter transfer 能力接口。
- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 接入 live `pre-order transfer-in` 与 observer `transfer-out` 编排。
  - transfer 异常统一以 `TRANSFER_TIMEOUT`、`TRANSFER_ERROR`、`TRANSFER_CURRENCY_MISMATCH`、`TRANSFER_ACTIVE_ORDER_CONFLICT` 等原因 fail-close 到 `audit_only`。
- `apps/signal-trader/src/runtime/runtime-manager.ts`、`apps/signal-trader/src/app.ts`、`apps/signal-trader/src/runtime/runtime-config.ts`
  - 透传 transfer 能力、配置校验与默认装配，让 transfer 走与 `submitOrder` 同级的可配置执行接口，而不是把 SQL / polling 硬编码进主流程。

### 3. live / paper venue 与环境装配

- `apps/signal-trader/src/bootstrap-from-env.ts`
  - 新增 live transfer 查询、提交、轮询逻辑。
  - `queryTradingBalance` 使用最新账户余额；`findActiveTransfer` 按 `runtime_id` + 账户对 + 币种过滤；`submitTransfer` 写入 `transfer_order`；`pollTransfer` 轮询终态并处理 timeout。
- `apps/signal-trader/src/__tests__/bootstrap-from-env.test.ts`
  - 验证默认 transfer venue 与服务策略相关行为。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - 覆盖 paper transfer-in/out、live pre-order transfer-in、live observer transfer-out 去重与 cooldown，以及 `TRANSFER_CURRENCY_MISMATCH`、`TRANSFER_TRADING_ACCOUNT_CONFLICT` 等路径。

### 4. 数据库与隔离

- `tools/sql-migration/sql/transfer_order.sql`
  - 为 `transfer_order` 增加 `runtime_id` 列与 `(runtime_id, status)` 索引，支撑 active transfer 的 runtime 隔离与查询效率。

### 5. 文档与审查材料

- `/.legion/tasks/signal-trader-funding-transfer/docs/review-code.md`
  - 代码审查结论 `PASS-WITH-NITS`，确认 shared account 冲突、currency mismatch、projection 语义等 blocker 已收敛。
- `/.legion/tasks/signal-trader-funding-transfer/docs/review-security.md`
  - 安全审查结论 `PASS-WITH-NITS`，确认 `runtime_id` 隔离、transfer fail-close、防呆校验已到位。
- `.legion/playbook.md`
  - 追加“真实资金 transfer 复用既有 controller，并按 runtime 隔离 active transfer”的项目约定，避免后续任务再次踩到跨 runtime 误复用的问题。

## 如何验证

- 详细测试记录：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-funding-transfer/docs/test-report.md`。
- 建议按以下顺序验证：

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 预期：build 通过；`lib/index.test.js` 17 passed；API Extractor 通过。
   - 已知 warning：TypeScript `5.9.3` 高于 Heft / API Extractor 已验证版本。

2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`（workdir=`/Users/c1/Work/signal-trader`）

   - 预期：`@yuants/app-signal-trader` 与依赖链构建通过。
   - 关键覆盖：transfer happy path / mismatch / conflict 回归通过。

3. `npm run build`（workdir=`apps/signal-trader`）

   - 预期：`lib/__tests__/bootstrap-from-env.test.js` 9 passed，`lib/__tests__/signal-trader-app.test.js` 36 passed，总计 45 passed。
   - 已知 warning：Jest worker 未优雅退出，疑似 open handles / timer 泄漏。

4. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`（workdir=`/Users/c1/Work/signal-trader`）
   - 预期：library + app 联合目标在同一 Rush 依赖图下通过。

## 风险与回滚

- 主要风险：
  - logical projection 与真实 trading 账户可用余额口径仍可能存在 venue 差异。
  - observer transfer-out 若外部 controller 长时间卡住，会以 `TRANSFER_TIMEOUT` 锁运行时。
  - shared account 当前采取保守策略：直接拒绝冲突，而非做账户级聚合调度。
- 当前审查结论允许交付，但都保留 nits：见 `review-code.md`、`review-security.md`。
- 回滚策略：
  - 最快方式是移除或忽略 `runtime.metadata.signal_trader_transfer`，使 runtime 回到无 transfer 模式。
  - 若 live 风险扩大，可直接 disable 对应 runtime，或回滚到不启用 transfer 的配置。
  - SQL 侧仅新增兼容列与索引，历史 `transfer_order` 保留用于审计，无需物理删除。

## 未决项与下一步

- 未决项：
  - live trading balance 当前优先沿用既有 `balance/free` 口径，后续若 vendor 侧出现偏差，需要进一步细化可用余额定义。
  - timeout / poll error 的负向测试仍偏少，可继续补齐更强的失败回归与监控聚合。
  - 默认 `allowAnonymousRead` / `SIGNAL_TRADER_ASSUME_INTERNAL_TRUSTED` 的部署面安全边界仍偏宽，需要后续单独收紧。
- 下一步建议：
  1. 先在单一白名单 runtime 灰度启用 transfer metadata，观察 `transfer_submitted` / `transfer_completed` / `transfer_failed` 审计日志。
  2. 继续补 `TRANSFER_TIMEOUT`、poll error、controller 卡顿等负向集成测试。
  3. 若后续确有多 runtime 共用账户需求，再单独设计账户级 planner，而不是放宽当前冲突保护。
