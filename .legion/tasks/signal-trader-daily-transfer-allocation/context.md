# signal-trader-daily-transfer-allocation - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已完成差异确认：当前实现是预算每天释放 + 按需补资，不是用户要的“每天固定拨资到 trading account”。
- 已在 `libraries/signal-trader` 重做 daily allocation 核心语义：`funding_account` 表示未拨资本，`trading_account` 表示已拨资本池，`available_vc` 表示交易池内仍可扩张容量。
- 已在 `apps/signal-trader` 改造 runtime transfer 调度：paper boot/paper clock/submit 与 live boot/observer 都会按日补资；sweep 仅回 excess。
- 已完成验证：library build 通过、app build 通过、Rush build 通过、paper 前端 Playwright 通过。

### 🟡 进行中

- 正在整理 walkthrough / PR body 与任务文档。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                                                                                  | 原因                                                                                                   | 替代方案                                                                                                                                           | 日期       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 新的 logical account 语义冻结为：`funding_account = vc_budget - released_vc_total`，`trading_account = released_vc_total - precision_locked_amount`，`available_vc = max(0, trading_account - current_reserved_vc)`。 | 这样才能同时满足“每天固定拨资到 trading”和“当前已保留风险额度仍要可计算”两个目标。                     | 继续让 `trading_account = current_reserved_vc`；缺点是无法表达“未下单也已拨入 trading 的资本池”。                                                  | 2026-03-23 |
| transfer 调度改成 daily allocation 驱动：deficit 会在 live observer / paper clock advance / submit/boot 等入口补齐；excess 只回收超出 `trading_account + buffer` 的余额。                                             | 这样既能实现“不下单也拨资”，又不会在平仓后把已分配本金立刻 sweep 回 funding。                          | 继续只在 `place_order` 前补资；缺点是和目标相反。                                                                                                  | 2026-03-23 |
| `trading_account` 定义为已拨入 trading 的资本池总额，而不是已占用风险额度；`precision_locked_amount` 作为 trading 池内不可交易部分单独扣减 `available_vc`。                                                           | 只有这样才能表达“每天固定拨资到 trading account”而不把 precision lock 的资金从账户余额语义里凭空消失。 | 让 `trading_account = released_vc_total - precision_locked_amount`；缺点是会把 precision lock 同时从“已拨资本池”和“可用余额”两边扣掉，语义不自洽。 | 2026-03-23 |
| runtime transfer 统一使用 `getTradingCapitalTarget()`，其下限为 `max(trading_account, current_reserved_vc + precision_locked_amount) + buffer`。                                                                      | 这样可以在新日拨语义和 over-reserved 兼容场景下同时避免误 sweep 现有仓位所需资金。                     | 只按 `trading_account + buffer`；缺点是 over-reserved 时会把维持现有仓位所需余额也当成 excess。                                                    | 2026-03-23 |
| paper 不通过 query side-effect 补资，而是通过 boot、paper clock advance 与 submit 后同步日拨 capital。                                                                                                                | 这样既能实现“不下单推进一天也拨资”，又避免把普通 query 变成隐式资金动作。                              | 在 queryProjection 时触发 paper transfer；优点是实现直观，缺点是读接口会产生副作用。                                                               | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-daily-transfer-allocation/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续向 full capital ledger 推进，下一轮优先细化盈利/人工补款/excess 来源，并决定 sweep 是否继续默认回 funding。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前验证结论：library build 26/26 passed，app build 50/50 passed，Rush build through，paper 前端 E2E 1/1 passed；唯一稳定 warning 是 app Jest worker teardown。

---

_最后更新: 2026-03-23 21:15 by Claude_
