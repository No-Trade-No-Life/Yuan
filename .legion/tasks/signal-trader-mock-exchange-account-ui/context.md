# signal-trader-mock-exchange-account-ui - 上下文

## 会话进展 (2026-03-24)

### ✅ 已完成

- 已完成现状调研：确认 mock 成交价此前硬编码为 `1`，且 paper 路径没有维护 `IAccountInfo` / 持仓账本。
- 已完成前端调研：主前端适合复用标准 `AccountInfo` 流，独立前端需要新增 mock account card。
- 已完成 task-local RFC 与 review-rfc，设计收敛为 `PASS-WITH-NITS`。
- 已在 `apps/signal-trader` 落地 `paper-account-ledger.ts`、mock fill context、`SignalTrader/GetMockAccountInfo`、以及 app 启动层 `PaperAccountPublisherRegistry`。
- 已把标准 `QueryAccountInfo` / `AccountInfo` 的暴露门禁绑定到 `allowAnonymousRead === true`，并补匿名关闭的负向回归测试。
- 已在 `ui/signal-trader-web` 增加 mock account card，展示原始 `runtime.account_id`、派生 `mock account_id`、money 摘要和持仓明细。
- 已完成验证：app/ui TypeScript 检查通过，`apps/signal-trader` Heft 测试 57 通过，独立前端 build 通过，mock Playwright 冒烟通过。
- 已完成代码审查与安全审查，结论分别为 `PASS` 与 `PASS`。
- 已生成 `docs/test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 已确认 `profit_target_value` 当前只是 account-scoped advisory alert，不会自动平仓。
- 已定位平仓投影分叉的核心原因：`signal=0` 时 `OrderSubmitted.attribution` 基于 `target_position_qty !== 0` 收集，导致 forced-flat close order 可能没有 attribution，fill 无法回写 `settled_position_qty`。
- 已修复 `signal=0` / forced-flat attribution：`OrderSubmitted.attribution` 改为按 `target_position_qty - settled_position_qty` 分摊，平仓后 product projection 与 mock account 都能收敛到空仓。
- 已把 `profit_target_value` 从 advisory-only 升级为 runtime worker auto-flat：命中阈值后自动追加 `submit_signal(signal=0, source='agent')`，平仓完成后把 subscription 持久化为 `closed`。
- 已增加保护：外部传入 `source='agent'` 会在 runtime worker 入口被降级为 `manual`；在 `flatten_requested` 窗口内会拒绝外部新 signal（`PROFIT_TARGET_FLATTENING`）。
- 已完成最新验证：core `heft test` 29/29 通过、app root `tsc --noEmit` 通过、app `heft build` 通过、ui `npm run build` 通过、focused runtime verification script 通过。
- 已完成最新评审：`review-code` 与 `review-security` 均更新为 `PASS-WITH-NITS`。
- 已在重启后的 mock 联调环境上用浏览器自动化走通前端开仓/平仓：初始账户 `balance=10`，开仓后 `LONG 1 @ 10`、`used=10`，平仓后账户收敛到 `balance=20/equity=20` 且 `QueryProjection(product)` 回到空仓。
- 已验证 paper clock 跨天行为：对 `runtime-mock` 前进 1 天后，在无持仓且 runtime 仍 active 的情况下，系统自动再次执行 daily allocation，`trading_account`/mock account balance 从 20 提升到 30，product projection 仍保持空仓。
- 已继续验证多日 paper 行为：在当前 `runtime-mock` 上连续推进 9 天后，`trading_account` / `available_vc` 最终收敛到 `vc_budget=100`，之后再推进天数不再继续增长；mock account 最终稳定在 `balance/equity=110`、空仓。
- 已继续验证 profit target 生命周期跨天保持关闭：focused runtime script 中，auto-flat 完成后的 `subscription_status=closed` 在下一天 observer snapshot 到来后仍保持 `closed`，不会再次触发 flat，也仍会拒绝新的 submit。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/signal-trader/src/execution/paper-account-ledger.ts`：mock `IAccountInfo` 最小账本与持仓记账。
- `apps/signal-trader/src/execution/paper-execution-adapter.ts`：mock fill price 解析、transfer clamp、mock 账户事件发射。
- `apps/signal-trader/src/services/paper-account-publisher-registry.ts`：标准 `QueryAccountInfo` / `AccountInfo` 生命周期管理。
- `apps/signal-trader/src/services/signal-trader-services.ts`：新增 `SignalTrader/GetMockAccountInfo`。
- `ui/signal-trader-web/src/app.tsx`：独立前端 mock account card。

---

## 关键决策

| 决策                                                                                                                                  | 原因                                                                                                                                  | 替代方案                                                                                                             | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| mock 账户能力优先落在 app 层 paper adapter，而不是改 `libraries/signal-trader` domain 真相。                                          | 用户需求是 mock-only 的可解释联调能力；若把 `IAccountInfo` 账本直接塞进 core event-sourcing，会显著扩大 domain scope 与 replay 契约。 | 把 mock 账户升级成 core domain projection；优点是更统一，缺点是本轮 scope 膨胀且会影响正式路径边界。                 | 2026-03-24 |
| 对外标准账户流使用 runtime 派生的唯一 `mock account_id`，而不是直接复用 runtime 原始 `account_id`。                                   | 这样可以避免多个 paper runtime 复用同一原始 account_id 时发生串线，同时保持内部继续按 runtime 管理 mock 状态。                        | 直接复用原始 `account_id`；优点是更直观，缺点是多 runtime 场景下 `QueryAccountInfo` / `AccountInfo` 会失去唯一主键。 | 2026-03-24 |
| transfer allocation 与 mock account equity 分层维护，transfer-out 按 `min(requested, max(free, 0))` clamp。                           | 既保住现有 daily allocation / `queryTradingBalance` 预算语义，又避免 mock `free` 被自动 sweep 扣成负数。                              | 让交易盈亏直接回写 allocation，或 transfer-out 不看 `free`；前者会污染资本预算语义，后者会制造不自洽账户状态。       | 2026-03-24 |
| 标准 `QueryAccountInfo` / `AccountInfo` 只在 `allowAnonymousRead === true` 时注册；独立前端读面走 `SignalTrader/GetMockAccountInfo`。 | 这样可避免标准 mock 读面绕过 signal-trader 读策略，同时保持主前端在匿名读显式开放时仍能复用现有账户生态。                             | 无条件注册标准读面；优点是接线更直接，缺点是会扩大未受控暴露面。                                                     | 2026-03-24 |

---

## 快速交接

**下次继续从这里开始：**

1. 如果要继续做产品体验层验证，可考虑在前端显式展示当前 paper clock offset，以及 `flatten_requested` / `closed` 生命周期 badge。

**注意事项：**

- 多日 paper 验证显示：在已有历史状态的 `runtime-mock` 上，跨天资金会继续按日拨直到 `vc_budget` 封顶；封顶后继续推进天数不会再增加。
- profit target focused verification 显示：`profit_target_flat_submitted` / `profit_target_lifecycle_completed` 审计记录在次日不会重复新增，关闭状态会持续生效。

---

_最后更新: 2026-03-25 11:02 by Claude_
