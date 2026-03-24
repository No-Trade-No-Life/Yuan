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

1. 直接使用 `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/pr-body.md` 作为 PR 描述发起 Review/合并。
2. 如果后续需要“authenticated-only 的标准 mock 读面”，单独开任务设计 `authorizeRead` 级别的授权模型，而不是继续复用 `allowAnonymousRead` 门禁。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 本次 `ui/signal-trader-web` 的 `playwright.config.js` / `vite.config.js` 及其 `.d.ts` 变更来自前端 build 生成物；提交前如需缩小 diff，可按仓库约定决定是否一并提交。

---

_最后更新: 2026-03-24 22:05 by Claude_
