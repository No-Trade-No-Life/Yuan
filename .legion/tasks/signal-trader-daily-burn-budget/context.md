# signal-trader-daily-burn-budget - 上下文

## 会话进展 (2026-03-22)

### ✅ 已完成

- 已完成 task-local RFC 与 review-rfc，blocker 已收敛为 PASS-WITH-NITS。
- 已在 `libraries/signal-trader` 落地统一 budget helper，并把 dispatch/query/reconciliation 三条主链接入同一 lazy-evaluate 语义。
- 已在 `apps/signal-trader` 收口单次调用时钟采样，并补齐 paper/live 跨天预算回归测试。

### 🟡 进行中

- 正在整理测试报告、代码/安全评审结论与 walkthrough / PR body。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                                           | 原因                                                                                                                                                         | 替代方案                                                                                                                                                  | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 本轮把预算释放语义收口为 core lazy-evaluate：`released_vc_total` 按 full-day 增长，`effective_vc_budget = available_vc + current_reserved_vc`，paper/live 只负责提供当前时间。 | 如果只在 app 层补，paper/live 会分叉；而 sizing 要在已有持仓上也吃到新增释放额度，因此不能只看 `available_vc`，必须把已占用风险与新释放额度一起计入有效 VC。 | 1) 只在 app 层给 query 结果做补算；缺点是 dispatch/replay 仍旧错误。2) 继续沿用静态 `vc_budget` 做 sizing；缺点是 `daily_burn_amount` 仍然形同虚设。      | 2026-03-22 |
| 测试中的“下一天”按固定 24h 窗口推进，app 测试优先使用 Jest fake timers / `setSystemTime`，而不是额外发明新的 runtime 时钟协议。                                                | 当前 app/runtime 绝大多数时间源都直接读 `Date.now()`；用 fake timers 改动最小，也最容易稳定验证 paper/live 共用路径。                                        | 给 runtime 新增公开 clock provider 配置；优点是可显式注入，缺点是会扩大公开接口与实现面，本轮不是最小必要。                                               | 2026-03-22 |
| 在 projection 中显式保留 `released_vc_total`，并将其作为 lazy-evaluate 的 cache 字段参与 replay/query/dispatch，而不是把该值拆到新的数据库 schema。                            | 仅靠 `available_vc` 无法无损表达 over-reserved 场景；把 `released_vc_total` 保留在 projection cache 内，既能维持 replay 一致性，又不需要扩数据库真相模型。   | 1) 只靠 `available_vc + reserved` 反推 released 值；缺点是在 over-reserved 与历史快照兼容场景下语义脆弱。2) 新增持久化 schema；缺点是超出本轮最小 scope。 | 2026-03-22 |
| `over-reserved` 状态的处理策略为：允许维持现状、不隐式缩仓、但在 release 追平前禁止同向扩张。                                                                                  | 这能同时满足 RFC 对“保持仓位连续性”和“release 追平前不能继续放大风险”的要求，避免通过收紧 entry 等参数绕过预算约束。                                         | 1) budget helper 自动强制缩仓；缺点是会让 query/dispatch 无事件地产生 target 收缩。2) 允许继续同向扩张；缺点是与 daily burn 预算窗口目标冲突。            | 2026-03-22 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-daily-burn-budget/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需进一步收口语义，可补一条更直接的 over-reserved 扩张拒绝回归测试，并继续清理 `@yuants/app-signal-trader` 的 Jest worker warning。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前验证结论：Rush 构建通过；`libraries/signal-trader` 直跑 `npm run build` 通过；`apps/signal-trader` 直跑 `npm run build` 通过但保留既有 Jest worker 未优雅退出 warning。

---

_最后更新: 2026-03-22 15:13 by Claude_
