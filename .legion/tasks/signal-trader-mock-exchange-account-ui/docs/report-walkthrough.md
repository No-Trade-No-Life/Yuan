# signal-trader mock exchange account UI Walkthrough

## 目标与范围

- 目标：在既有 mock account/UI 闭环基础上，补齐 forced-flat 收敛、profit target 自动平仓与生命周期终结、runtime submit 防护，以及前端订阅状态风险门禁。
- 范围绑定：仅覆盖 `apps/signal-trader/**`、`libraries/signal-trader/**`、`ui/signal-trader-web/**` 与本任务文档；不扩展到 live 路径、数据库 schema 或新的授权模型。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/rfc.md`
- 本轮沿用 RFC 的 mock-only 边界：mock 账本仍留在 app 层，但允许在 `libraries/signal-trader` 内修复 forced-flat attribution 与 profile lifecycle 所必需的 domain/runtime 语义。
- 交付重点从“可见的 mock 账户”扩展为“可收敛、可终止、可防伪造写入”的完整平仓闭环。

## 改动清单

### 1. forced-flat attribution 与空仓收敛

- `libraries/signal-trader/src/engine/dispatch-command.ts`
  - 修复 `signal=0` forced-flat 的 attribution 收集逻辑，改为按 `target_position_qty - settled_position_qty` 的待结算缺口分摊。
  - 结果是 forced-flat close fill 不再丢失 attribution，`settled_position_qty` 能正确回写。
- `libraries/signal-trader/src/domain/reducer.ts` 及相关 core 路径
  - 配合 close fill 回流，保证 `QueryProjection(product)` 在平仓完成后收敛到空仓，而不是停留在旧 `current_net_qty`。
- 业务结果
  - `signal=0` 后 mock account 与 product projection 现在都会一致收敛到空仓，消除“账本已平、projection 未平”的分叉。

### 2. `profit_target_value` 从 advisory 升级为 auto-flat + lifecycle close

- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 当观察到账户权益达到 `profit_target_value` 时，自动提交 `signal=0` forced-flat，而不再只是记 advisory alert。
  - 平仓完成后把 profile/subscription 生命周期关闭，`subscription_status` 收敛为 `closed`。
  - 关闭后拒绝后续外部 submit，避免 profile 在目标达成后重新进入交易。
- 相关审计/状态链路
  - 审计日志已覆盖 `profit_target_flat_submitted` 与 `profit_target_lifecycle_completed`，便于回放 auto-flat 触发与关闭动作。

### 3. runtime worker 写入防护与 source sanitize

- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 在 `flatten_requested` 期间拒绝新的外部 signal，避免自动平仓窗口被 manual/model submit 打断。
  - 外部伪造 `source='agent'` 的请求会在 worker 入口被降级为 `manual`，不能再借 agent 身份绕过写入约束。
- 安全含义
  - 自动平仓能力继续保留内部 agent 路径所需权限，但外部调用面不会因为伪造 source 而被放大。

### 4. 前端风险门禁补齐

- `ui/signal-trader-web/src/risk.ts` 及相关提交链路
  - 当前前端 risk gate 在 `subscription_status !== active` 时禁用提交。
  - 这样与后端 `closed` 生命周期拒绝保持一致，避免用户在已终结 profile 上继续发单。

### 5. 评审与交付文档

- 测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`
- 代码审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-code.md`
- 安全审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md`

## 如何验证

- core 单测
  - `./node_modules/.bin/heft test --clean`（workdir=`libraries/signal-trader`）
  - 预期：29/29 通过，覆盖 forced-flat attribution、profit target alert/action 语义等 core 回归。
- app root TypeScript
  - `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p apps/signal-trader/tsconfig.json --noEmit`
  - 预期：成功退出，无新增类型错误。
- app build
  - `./node_modules/.bin/heft build --clean`（workdir=`apps/signal-trader`）
  - 预期：构建成功，runtime worker / services 最新改动可编译产出。
- ui build
  - `npm run build`（workdir=`ui/signal-trader-web`）
  - 预期：`tsc -b && vite build` 成功，前端 risk gate 变更纳入构建验证。
- focused runtime verification script
  - 预期：验证 profit target 命中后自动提交 `signal=0`、平仓后 projection 收敛到空仓、`subscription_status=closed`，以及关闭后 submit 返回 `RUNTIME_SUBSCRIPTION_INACTIVE`。
- 详细执行记录见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/test-report.md`

## 风险与回滚

- 风险 1：`profit_target_value` 当前仍基于单次观测越阈值触发 auto-flat，异常快照或 reconciliation mismatch 仍有过早平仓风险。
  - 参考：`review-security.md`
- 风险 2：`flatten_requested` 是 runtime 内部瞬时态，前端目前只能感知 `closed`，仍可能出现“UI 看起来可提交、后端返回 `PROFIT_TARGET_FLATTENING`”的短窗口。
  - 参考：`review-code.md`
- 风险 3：app 全量 Heft suite 在当前环境会触发 OOM，本轮最终以 core 全量单测 + app root tsc + app build + ui build + focused runtime verification script 为准。
- 回滚方案：
  - 若需快速回退新增 lifecycle/forced-flat 语义，可撤销 `libraries/signal-trader` 的 attribution / auto-flat 相关改动与 `apps/signal-trader` runtime gate；
  - 若需回退 UI 行为，可单独移除 `subscription_status !== active` 的前端提交禁用；
  - 全部回滚均不涉及 schema/data migration。

## 未决项与下一步

- 当前验证结论为可进入 PR 审阅，但 app 全量 Heft suite 的 OOM 仍需后续单独治理。
- 建议补专项回归：
  - 外部伪造 `source='agent'` 在 audit_only/flattening 场景下的拒绝用例；
  - `flatten_requested` 窗口 submit reject；
  - 多 subscription + partial fill 下 forced-flat attribution 收敛用例；
  - reconciliation mismatch/异常快照下是否应允许 auto-flat 的策略测试。
- 如要进一步降低交互落差，可评估是否把 `flatten_requested` 暴露给前端读面，而不只在后端拒绝。
