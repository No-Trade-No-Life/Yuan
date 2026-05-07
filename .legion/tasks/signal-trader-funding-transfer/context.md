# signal-trader-funding-transfer - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

(暂无)

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                                | 原因                                                                                                                                                             | 替代方案                                                                                                                                  | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 本轮 transfer MVP 复用现有 `transfer_order` + `apps/transfer-controller`，不新建 transfer schema；runtime 级资金账户配置放在 `SignalTraderRuntimeConfig.metadata`。 | 仓库已经有成熟的 transfer 状态机与 vendor 接口；如果再扩一层新协议或新表，会显著放大 scope。metadata 承载 funding account / currency 也能避免本轮动 SQL 表结构。 | 1) 新增 signal-trader 专用 transfer 表与 controller；缺点是重复造轮子。2) 只做 projection 不做真实 transfer；缺点是无法满足用户明确要求。 | 2026-03-23 |
| 为消除跨 runtime 误复用 active transfer 的风险，允许在 `transfer_order` 表上追加最小 `runtime_id` 列，并在 live transfer venue 中按 `runtime_id` 过滤活动单。       | 在不改 transfer controller 协议的前提下，仅靠账户对/币种过滤仍可能吃到别的 runtime 的活跃转账；最小新增 `runtime_id` 列是唯一可审计、可查询、可回滚的隔离手段。  | 1) 继续只按账户对/币种过滤；缺点是跨 runtime 隔离不足。2) 禁止所有共享 funding/trading 组合而不落列；缺点是历史活跃单与重启恢复仍不稳。   | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `.legion/tasks/signal-trader-funding-transfer/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如需继续增强稳健性，可补 `TRANSFER_TIMEOUT` / poll error / controller 卡顿 的负向集成测试，并观察真实 deployment 下的 service policy 环境变量默认值。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前审查结论：code review 与 security review 均为 `PASS-WITH-NITS`；剩余主要是 secure-by-default 与 timeout/poll error 覆盖深度问题。

---

_最后更新: 2026-03-23 13:16 by Claude_
��: 2026-03-23 13:16 by Claude\*
