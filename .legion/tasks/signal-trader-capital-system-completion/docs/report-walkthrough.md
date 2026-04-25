# signal-trader-capital-system-completion 交付 Walkthrough

## 目标与范围

- 目标：补齐 `signal-trader` 资本系统剩余核心能力，使 buffer、internal netting、profit target alert、只读聚合查询与 reconciliation 升级形成可解释、可回放、可测试、可回滚的阶段性完成态。
- Scope 绑定：`libraries/signal-trader/**`、`apps/signal-trader/**`、`.legion/playbook.md`。
- 本次实现重点落在 `libraries/signal-trader`，`apps/signal-trader` 仅做最小查询/权限/测试配合。
- 非目标保持不变：不引入 full capital ledger、不新增 SQL schema、不重做 transfer controller / transfer 协议。

## 设计摘要

- 设计基线见 `/.legion/tasks/signal-trader-capital-system-completion/docs/rfc.md`，RFC 审查见 `/.legion/tasks/signal-trader-capital-system-completion/docs/review-rfc.md`。
- 设计收口到五个最小闭环：
  - `precision_lock` 驱动的 `buffer_account` 首版真语义；
  - `MidPriceCaptured` + `InternalNettingSettled` 驱动的 internal netting 事件链；
  - 基于账户快照的 `profit_target_reached` advisory alert；
  - `investor` / `signal` query-time derived projection；
  - account-scoped reconciliation + tolerance/explanation 小步升级。
- 关键边界维持保守：buffer 不进入 reconciliation mismatch 主判定；profit target 不宣称 investor/subscription 级强事实；internal netting 缺价格证据时 fail-close。

## 改动清单

### 1. Core 资本语义与数据模型

- `libraries/signal-trader/src/types/snapshot.ts`
  - 为 subscription、investor buffer、reconciliation、新 query 类型补齐结构定义。
  - 新增 `precision_locked_amount`、`precision_lock_source_event_id`、buffer source、`InvestorProjection` / `SignalProjection`、reconciliation explanation/tolerance 等字段。
- `libraries/signal-trader/src/types/events.ts`
  - 补齐 `MidPriceCaptured`、`InternalNettingSettled` 与 `profit_target_reached` 相关事件类型语义。

### 2. Budget / Buffer / Reconciliation 计算主链

- `libraries/signal-trader/src/domain/evaluate-budget.ts`
  - 抽出并统一 `precision_lock` 预算计算，形成 released VC / funding / trading / precision lock 的守恒关系。
  - 新增 `getProjectedBalanceForAccount(...)`，把 projected balance 计算收口到 account scope。
  - reconciliation 从“严格单标量比较”升级为“account-scoped + rounding/tolerance + explanation”。
- `libraries/signal-trader/src/domain/reducer.ts`
  - 在 reducer 内维护 `precision_lock_source_event_id` 和 `investor_buffers` 聚合，保证时间推进后的 snapshot 仍自洽。
  - 接入 `MidPriceCaptured` / `InternalNettingSettled` 事件回放语义，避免无外部订单时账本无痕变化。

### 3. Command / Query 执行链路

- `libraries/signal-trader/src/engine/dispatch-command.ts`
  - 在 `submit_signal` 路径中增加 internal netting 触发与保守门禁。
  - 在 `capture_authorized_account_snapshot` 路径中追加 account-scoped `profit_target_reached` advisory alert。
  - reconciliation 判定改为使用 account-scoped projected balance。
- `libraries/signal-trader/src/engine/query-projection.ts`
  - 新增 `investor` / `signal` / `reconciliation` 查询投影，保持 query-time derived，不新增真相事件。

### 4. App 配套与默认安全面

- `apps/signal-trader/src/bootstrap-from-env.ts`
  - 默认不开放匿名只读；只有显式配置 `SIGNAL_TRADER_ALLOW_ANONYMOUS_READ=1` 才放开。
- `apps/signal-trader/src/__tests__/bootstrap-from-env.test.ts`
  - 补充服务策略与环境变量行为验证。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - 覆盖 app 侧最小查询/快照/运行时配合，确保 library 与 app 联动可用。

### 5. 测试与审查文档

- 测试报告：`/.legion/tasks/signal-trader-capital-system-completion/docs/test-report.md`
- 代码审查：`/.legion/tasks/signal-trader-capital-system-completion/docs/review-code.md`
- 安全审查：`/.legion/tasks/signal-trader-capital-system-completion/docs/review-security.md`

## 如何验证

- 参考测试报告：`/.legion/tasks/signal-trader-capital-system-completion/docs/test-report.md`
- 执行命令与预期：
  - `npm run build`（workdir=`libraries/signal-trader`）
    - 预期：`@yuants/signal-trader` build 通过，`lib/index.test.js` 24 passed，API Extractor 通过。
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
    - 预期：library 及依赖链在 Rush 下通过。
  - `npm run build`（workdir=`apps/signal-trader`）
    - 预期：app build 通过，`bootstrap-from-env` 与 `signal-trader-app` 测试共 45 passed。
  - `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
    - 预期：library + app 联合目标在同一 Rush 依赖图下通过。
- 本次重点验证项：
  - `precision_lock` 会进入 investor buffer，且 source 可追溯；
  - internal netting happy path 会追加 `MidPriceCaptured` / `InternalNettingSettled`；
  - 有 pending order 或缺价格证据时 internal netting 不触发；
  - `profit_target_reached` 以 account-scoped advisory 方式触发；
  - `investor` / `signal` projection 查询返回聚合结果；
  - reconciliation 可解释字段、tolerance 与 account scope 生效。
- 已知 warning：
  - Heft / Rush 对当前 Node.js、TypeScript 版本有已知 warning，但构建通过；
  - `@yuants/app-signal-trader` 仍有 Jest worker 未优雅退出 warning，不阻断本次交付结论。

## 风险与回滚

### 风险

- `MidPriceCaptured` 首版仍依赖 `submit_signal.entry_price` 作为最小价格证据，审计可用，但还不是强市场中价真相。
- `profit_target_reached` 仍是 account-scoped advisory alert，不是 investor/subscription 级盈亏真相。
- 若部署侧显式开启匿名读，新增加的 `investor` / `signal` / `reconciliation` 查询仍会暴露较敏感的资本聚合信息。
- reconciliation 对 tolerance 与 account scope 配置有依赖；错误配置仍可能导致解释偏差。

### 回滚

- 若 internal netting 后续验证不稳，可先回滚 `submit_signal` 触发逻辑，仅保留既有事件类型占位与其他资本能力。
- 若 reconciliation 新解释口径影响运营判断，可回滚到旧的严格相等判定，同时保留 buffer/query 交付。
- 若匿名读策略需要更严格，可保持默认关闭，并仅对白名单调用端定向放开。
- 回滚原则保持 append-only：优先关闭新增派生语义，不删除历史事件。

## 未决项与下一步

- 未决项：
  - 后续若要提升 realized/unrealized PnL 解释力，需要引入更正式的价格源，而不是长期依赖 `submit_signal.entry_price`。
  - `profit_target_value` 是否提升到 investor/profile 口径，仍需下一轮资本系统设计统一。
  - `InvestorProjection` / `SignalProjection` 目前是最小聚合视图，如上层长期依赖，建议补正式 API 契约文档。
- 下一步建议：
  - 合入后继续清理 `@yuants/app-signal-trader` 的 Jest teardown warning；
  - 为 internal netting 的价格证据与 PnL 归因准备下一轮 RFC；
  - 视部署需求收紧匿名读配置与查询暴露面。
