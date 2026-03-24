# signal-trader mock exchange account UI Walkthrough

## 目标与范围

- 目标：为 `signal-trader` 的 paper/mock 路径补齐最小账户账本、可控 mock 成交价，以及主前端与独立前端的 mock 账户展示闭环。
- 范围绑定：仅覆盖 `apps/signal-trader/**`、`ui/signal-trader-web/**` 与本任务交付文档，不扩展到 live 路径、数据库 schema 或 `libraries/signal-trader` domain 真相。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/rfc.md`
- RFC 评审结论：`PASS-WITH-NITS`，核心边界已收敛，包括派生 `mock account_id`、transfer free clamp、paper-only 定价上下文，以及 app 启动层 publisher registry 生命周期。
- 最终实现继续遵守 mock-only 原则：账本与发布能力留在 app 层，不污染共享执行接口和 live 账户协议。

## 改动清单

### 1. mock 成交与账户账本

- `apps/signal-trader/src/execution/paper-account-ledger.ts`
  - 新增独立 ledger，按 `runtime_id` 维护 mock 账户状态。
  - 生成唯一 `mock account_id`，避免多个 runtime 复用原始 `account_id` 串线。
  - 实现 transfer、开平仓、已实现盈亏、浮动盈亏、`balance/equity/free/used` 与 position 快照计算。
- `apps/signal-trader/src/execution/paper-execution-adapter.ts`
  - mock fill price 不再固定为 `1`，而是按 `entry_price -> reference_price -> last_price/position_price -> fallback_1` 解析。
  - place order 成交后直接驱动 ledger 更新，并向订阅者推送标准 `IAccountInfo`。
  - transfer 仍维持 allocation 余额语义，同时通过 ledger 的 `free` clamp 保护 mock money 不被扣成明显不自洽状态。

### 2. runtime 与服务发布链路

- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 在 `submitSignal` 后、`executeEffects` 前写入 paper-only mock fill context，使 mock 成交价可继承用户提交的 `entry_price` 与 worker 准备出的 `reference_price`。
- `apps/signal-trader/src/services/paper-account-publisher-registry.ts`
  - 新增标准账户发布 registry，以当前启用的 paper runtime 集合做全量对账。
  - 统一注册/刷新/清理 `QueryAccountInfo` 与 `AccountInfo`，避免 runtime upsert、disable、restart 时出现残留服务。
  - 当前仅在 `allowAnonymousRead === true` 时暴露标准 mock 读面，安全边界已通过专项复审。
- `apps/signal-trader/src/services/signal-trader-services.ts`
  - 新增 `SignalTrader/GetMockAccountInfo`，独立前端可按 `runtime_id` 查询标准 `IAccountInfo`，不需要预先知道派生后的 `mock account_id`。

### 3. 独立前端读面

- `ui/signal-trader-web/src/app.tsx`
  - 仅在 `paper + paper_simulated` runtime 下查询并展示 mock account card。
  - 展示 `balance/equity/profit/free/used/updated_at`、持仓明细，以及原始 `runtime.account_id` 与派生 `mock account_id`。
  - 失败隔离在 card 内，不影响健康态、projection、audit 等既有读面。

### 4. 验证、评审与复用约定

- 测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`
- 代码审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-code.md`
- 安全审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md`
- 仓库约定：`/Users/c1/Work/signal-trader/.legion/playbook.md` 已追加 mock account 复用约定，明确前端优先复用标准 `AccountInfo`、使用派生 `mock account_id`，并要求标准读面绑定显式门禁。

## 如何验证

- TypeScript 检查
  - `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p apps/signal-trader/tsconfig.json --noEmit`
  - `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p ui/signal-trader-web/tsconfig.json --noEmit`
  - 预期：两条命令成功退出，无额外产物。
- app 测试
  - `./node_modules/.bin/heft test --clean`（workdir=`apps/signal-trader`）
  - 结果：57/57 Jest 用例全部通过，覆盖 mock 盈利 +10、fallback 定价、transfer free clamp、runtime account_id 变更回归、标准 mock 读面注册/清理与匿名关闭负向测试。
- 独立前端构建
  - `npm run build`（workdir=`ui/signal-trader-web`）
  - 预期：`vite build` 成功。
- Playwright 冒烟
  - `./node_modules/.bin/playwright test tests/signal-trader.spec.ts --grep @mock`（workdir=`ui/signal-trader-web`）
  - 预期：`@mock loads runtime health and mock account card` 通过，可看到 mock account card 正常展示。
- 详细执行记录见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`

## 风险与回滚

- 风险 1：mock 标准读面若无门禁，可能绕过 signal-trader 既有读权限模型。
  - 当前状态：已收敛为仅在 `allowAnonymousRead === true` 时注册，并已补“匿名读关闭时不注册标准 mock 读面”的负向回归测试；安全审查结论 `PASS`。
- 风险 2：用户把 allocation balance 与 mock account equity 混为一谈。
  - 当前缓解：transfer 余额与 mock 账本仍分层维护，交易盈亏只影响 mock account，不回写 `queryTradingBalance` 的预算语义。
- 风险 3：runtime 生命周期变化导致标准账户服务残留或串线。
  - 当前缓解：registry 采用全量对账策略，按启用中的 paper runtime 集合刷新与清理。
- 回滚方案：移除 `paper-account-ledger.ts`、`paper-account-publisher-registry.ts`、`SignalTrader/GetMockAccountInfo` 与独立前端 mock account card，即可回退到原 paper-only 执行状态；不涉及 schema 回滚。

## 未决项与下一步

- 当前实现与代码/安全评审结论均为 `PASS`，具备进入 PR 审阅的条件。
- `.legion/playbook.md` 已沉淀本次 mock account 复用约定，后续同类前端/服务接入应直接沿用该约定，避免再次发散出 mock-only 协议。
- 若后续需要支持“需鉴权但不可匿名”的标准 `QueryAccountInfo` / `AccountInfo` 暴露，需要单独设计与 `authorizeRead` 对齐的细粒度授权模型。
- 如 PR 阶段需要更高信心，可补跑仓库级 Rush 目标构建；本轮已在测试报告中注明未执行仓库级 `rush build`。
