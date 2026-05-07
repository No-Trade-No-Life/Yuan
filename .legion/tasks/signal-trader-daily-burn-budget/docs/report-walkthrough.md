# signal-trader-daily-burn-budget 交付报告

## 目标与范围

- 目标：补齐 `daily_burn_amount` 的按天 lazy-evaluate 预算释放语义，让 `libraries/signal-trader` 与 `apps/signal-trader` 在 paper / live 路径上共用同一套预算规则，并交付完整实现与验证材料。
- 绑定 scope：
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 本次交付聚焦于 core 预算补算、dispatch/query/reconciliation 三条主链一致性、app 层单次调用时钟收口，以及跨天预算回归测试。
- 不包含新的数据库 schema、资金账户表、transfer 流程、UI 控时入口或额外的高强度安全边界重构。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/rfc.md`
- RFC 已通过对抗式评审，结论为 `PASS-WITH-NITS`，见 `review-rfc.md`。
- 方案核心是把预算语义收口到 core helper：`released_vc_total` 按固定 24h 窗口增长，`available_vc` 表示已释放且未被当前 target risk 占用的额度，`sizing_vc_budget` 负责在正常释放与 over-reserved 场景下给 sizing 提供统一预算口径。
- `dispatch`、`query`、`reconciliation` 都在读取 snapshot 前先做同口径 budget refresh；app 层只负责为单次请求或单次 worker 执行采样一次 `now_ms` 并贯穿到底，避免 paper / live 分叉。

## 改动清单

### Core budget 语义

- `libraries/signal-trader/src/domain/evaluate-budget.ts`
  - 新增统一 budget helper，集中实现首日 tranche、D+N lazy release、`available_vc`、`released_vc_total`、`sizing_vc_budget` 等派生语义。
- `libraries/signal-trader/src/domain/reducer.ts`
  - 调整 subscription 初始化与后续投影视图更新职责，确保新建 subscription 立即获得首日 tranche，并把预算补算职责从散落分支收回到 helper。
- `libraries/signal-trader/src/types/snapshot.ts`
  - 配合 projection/cache 视图补齐预算相关字段的表达，支撑 replay/query/dispatch 的一致性。

### Command / Query / Reconciliation 主链

- `libraries/signal-trader/src/engine/dispatch-command.ts`
  - 在命令处理前先按 `state.clock_ms` 做 snapshot budget refresh。
  - sizing 从静态 `vc_budget` 切换为 budget-aware 口径，并在 `over-reserved` 场景下显式阻止同向扩张。
- `libraries/signal-trader/src/engine/query-projection.ts`
  - query 改为读取 budget refresh 后的 projection，保证纯 query 也能看到跨天预算释放与推进后的 `last_budget_eval_at`。
- `libraries/signal-trader/src/index.ts`
  - 收口对外导出边界，避免把内部 budget helper 暴露成新的公共 API。

### App runtime 时钟一致性

- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - `submitSignal -> executeEffects -> appendCommand` 显式复用同一次提交采样得到的 `now_ms`。
  - `queryProjection()` 使用局部 state 副本，避免刷新预算时污染共享 `clock_ms`。
- `apps/signal-trader/src/runtime/runtime-manager.ts`
  - 脱机 query 路径也统一采样当前时间，保证 manager / worker 对同一时点预算语义一致。

### 测试与回归

- `libraries/signal-trader/src/index.test.ts`
  - 新增/补齐首日 tranche、D0 / D+1 / D+2 lazy release、query-only 刷新、reconciliation 预算口径、over-reserved 行为等核心断言。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - 补齐 paper / live 跨天预算回归，验证 query 与 submit 共用同一 daily burn 预算语义。

### 评审与交付文档

- `review-rfc.md`：RFC 对抗式审查通过，blocker 已关闭。
- `review-code.md`：代码审查结论 `PASS-WITH-NITS`，确认核心 blocker 已关闭。
- `review-security.md`：安全审查结论 `PASS-WITH-NITS`，未发现新增高风险写路径或越预算放大路径。
- `test-report.md`：记录 build/test 命令、覆盖点与 warnings。

## 如何验证

- 参考测试报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/test-report.md`
- 已执行命令与预期：

```bash
node common/scripts/install-run-rush.js build -t @yuants/signal-trader
```

预期：`libraries/signal-trader` build 通过，`lib/index.test.js` 共 16 个测试通过，API report 更新通过。

```bash
node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader
```

预期：`apps/signal-trader` build 通过，app 测试共 37 个测试通过；允许保留既有 Jest worker 未优雅退出 warning。

```bash
node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader
```

预期：library + app 联合目标在同一 Rush 依赖图下通过；warning 仅限既有 app test 退出清理问题。

```bash
npm run build
```

工作目录：`libraries/signal-trader`

预期：`heft test --clean` 与 `api-extractor run --local` 通过，`lib/index.test.js` 16 passed。

```bash
npm run build
```

工作目录：`apps/signal-trader`

预期：`heft test --clean` 通过，`signal-trader-app.test.js` 与 `bootstrap-from-env.test.js` 合计 37 passed；允许保留既有 warning。

## 风险与回滚

- 主要风险 1：`available_vc`、`released_vc_total`、`sizing_vc_budget` 再次被混用，导致 sizing 或 query 口径漂移。
- 主要风险 2：reconciliation 目前按执行时 `now_ms` 做 budget 补算，而非严格绑定 `account_snapshot.updated_at/captured_at`；跨日边界仍可能偏 fail-close 触发误锁。
- 主要风险 3：当前 `over-reserved` guard 仍以目标仓位数量变化为主，而不是直接比较风险金额；在现有约束下可接受，但长期值得进一步收口。
- 回滚方式：直接回滚本次实现代码即可恢复旧的静态 `vc_budget` 行为；本次无 schema 变更、无数据迁移、无事件格式升级，不需要额外回滚脚本。
- 回滚后需同步标记 RFC 与实现再次漂移，并保留本轮失败/回归用例，避免后续重复引入同类问题。

## 未决项与下一步

- 未决项 1：是否需要把 `released_vc_total` 暴露为 query / audit 诊断字段；RFC 当前结论是暂不扩大 API 面。
- 未决项 2：后续若引入多 reconciliation account / reserve account，需要拆分当前统一 `projected_balance` 口径。
- 未决项 3：若继续收口 live 安全边界，应优先统一“观察快照时间”与“预算求值时间”的口径，降低跨日边界误锁概率。
- 下一步建议：
  1. 以本报告和 `pr-body.md` 发起人类 review，优先关注 budget helper 语义、over-reserved guard 与 runtime 时钟一致性。
  2. 若 review 通过，再考虑补一条更直接的 `over-reserved` 拒绝扩张回归测试，减少语义回退风险。
