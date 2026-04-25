# signal-trader-capital-system-completion - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已完成现状调研：确认剩余主要缺口集中在 `buffer_account`、internal netting、profit target alert、investor/signal projection 与更可解释的 capital reconciliation。
- 已在 `libraries/signal-trader` 落地 `precision_lock` 最小闭环，并让 investor buffer 在时间推进后的快照里保持自洽。
- 已实现最小 internal netting：在满足保守门槛时追加 `MidPriceCaptured` + `InternalNettingSettled`，不再让内部权益迁移无痕发生。
- 已在账户快照链路上补齐 account-scoped `profit_target_reached` advisory alert，并让 `InvestorProjection` / `SignalProjection` 可查询。
- 已把 reconciliation 升级为 account-scoped + tolerance/explanation 模式，并收紧默认匿名读策略。
- 已在 `libraries/signal-trader` 落地 `precision_lock` 最小闭环，并让 `investor_buffers` 在 query/budget refresh 后保持自洽。
- 已实现最小 internal netting：保守门槛满足时追加 `MidPriceCaptured` + `InternalNettingSettled`，并让 subscription settled state 可回放。
- 已补齐 account-scoped `profit_target_reached` advisory alert、`investor` / `signal` projection 查询，以及 account-scoped reconciliation tolerance/explanation。
- 已完成验证：`libraries/signal-trader` build 通过、24 tests passed；`apps/signal-trader` build 通过、45 tests passed；Rush library+app 目标构建通过。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                                      | 原因                                                                                                                            | 替代方案                                                                                                                    | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 本轮剩余资本系统功能优先以 `libraries/signal-trader` 为主战场：buffer/netting/profit-target/projection 尽量落在 core，`apps/signal-trader` 仅做快照/测试/审计的最小配合。 | 这些能力本质上都是资本账本和投影视图语义；若继续在 app 层打补丁，会让 daily burn 与 transfer 后的资本系统更加分裂。             | 继续把告警/聚合/内冲抵放在 app 层；缺点是 replay/query 与运行时语义更容易漂移。                                             | 2026-03-23 |
| 资本对账本轮只做最小升级，不尝试把 funding/trading/buffer/transfer 真相一次性塞进 reconciliation。                                                                        | 当前 reconciliation 仍是单账户单标量模型；一次性升级成全资本总账会同时牵动多账户、transfer、buffer 和 observer 口径，风险过高。 | 直接扩成 full capital reconciliation；优点是更接近终局，缺点是 scope 会爆炸且更难保证 replay 稳定。                         | 2026-03-23 |
| `buffer_account` 首版只落 `precision_lock`，并把守恒关系限定在 subscription 级后再汇总到 investor buffer。                                                                | 这样能让 buffer 真正进入可回放闭环，同时避免一次性把 rounding/fee/其它残差一起塞进来导致 reconciliation 漂移。                  | 同时实现 lot_residual、rounding_delta、fee_hold；优点是更完整，缺点是会放大本轮 scope 与会计复杂度。                        | 2026-03-23 |
| `profit_target_reached` 首版降级为 account-scoped advisory alert，不宣称 investor/subscription 已达标。                                                                   | 当前没有 full capital ledger，也没有 shared account 下可证明的 subscription 级盈亏归因；直接宣称达标会制造误导性真相。          | 继续挂空字段不实现；缺点是 `profit_target_value` 继续是死配置。或直接做 investor 真相告警；缺点是超出当前资本模型能力边界。 | 2026-03-23 |
| reconciliation 改为按 `account_id / reserve_account_ref` 做 account-scoped projected balance，并默认关闭匿名读。                                                          | 否则既会把全局资金误当单账户真相，也会把新的资本聚合 query 面默认暴露给匿名读者。                                               | 继续用全局 projected balance + 开放匿名读；缺点是会导致误锁与信息暴露。                                                     | 2026-03-23 |
| `reconciliation` 升级为 account-scoped projected balance，并把 `reserve_account_ref` 绑定到 runtime 的 trading account，而不是 funding account。                          | 否则会把全局资金误当成单账户结论，也会让 profit target advisory 与对账共同绑错账户。                                            | 继续使用全局 projected balance；缺点是多账户下会产生误锁和误导性结论。                                                      | 2026-03-23 |
| `createSignalTraderServicePolicyFromEnv()` 默认不开放匿名读，只在显式 `SIGNAL_TRADER_ALLOW_ANONYMOUS_READ=1` 时开启。                                                     | 新增 `investor` / `signal` / `reconciliation` 查询后，继续默认开放匿名读会放大敏感资本聚合信息暴露面。                          | 保持匿名读默认开放；缺点是会把新 query 面默认暴露。                                                                         | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-capital-system-completion/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续接近 full capital ledger，下一轮优先补更正式的价格证据来源、fee/rounding buffer 细化，以及更强的 timeout/poll error 回归。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前审查结论：code review 与 security review 均为 `PASS-WITH-NITS`；剩余主要是价格证据来源、配置风险与 app test teardown warning。

---

_最后更新: 2026-03-23 14:37 by Claude_
