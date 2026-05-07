# signal-trader-capital-system-completion

## 目标

补齐 signal-trader 资本系统剩余核心能力，使实现更接近《资金持久战》目标，并交付完整 Legion 文档。

## 问题定义

- 当前 signal-trader 已经具备 `daily_burn_amount` 预算释放和 funding/trading 真实 transfer，但离资本系统目标仍有明显缺口。
- 现状缺口主要有五类：
  - `buffer_account` 只有 projection 壳子，没有残差/费用/精度的真实语义
  - `MidPriceCaptured` / `InternalNettingSettled` 只有 event type 与 reducer 占位，没有真正内冲抵主链
  - `profit_target_value` 只是配置字段，没有告警闭环
  - `InvestorProjection` / `SignalProjection` 没有查询面
  - capital reconciliation 仍是最小单标量，对资金系统的解释力不足
- 用户明确要求“继续做完为止”，因此本轮不能只做零散补丁，而要把上述剩余能力尽量收敛到一个可运行、可测试、可回滚的阶段性完成态。

## 验收标准

- `buffer_account` 真正生效：
  - 至少能承接 lot floor 残差 / precision lock / 费用占用中的最小闭环之一
  - 有可查询的来源链（`source_subscription_id` + `reason`）
- `MidPriceCaptured` + `InternalNettingSettled` 具备最小可用实现：
  - 当同一 product 内部目标变化互相对冲且外部 `external_order_delta=0` 时，生成内冲抵事件，而不是完全无痕变化
- `profit_target_value` 具备最小告警闭环：
  - 在账户快照链路上能触发 `profit_target_reached`
- `InvestorProjection` / `SignalProjection` 可查询：
  - 至少提供最小只读聚合视图，不要求新增真相事件
- 资本对账在不炸裂语义面的前提下推进一步：
  - 至少补 tolerance / rounding 处理
  - 不把多账户/多币种/transfer 真相一次性硬塞进本轮 reconciliation
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 本轮优先以 `libraries/signal-trader` 为主战场，`apps/signal-trader` 只在需要打通快照/测试/审计时最小配合。
- `buffer_account` 首版不追求完整资本总账，只先落地最小可解释闭环：
  - 由 rounding / lot floor / fee 等派生出可追踪的 buffer 变化
- `MidPriceCaptured` 首版允许使用 `submit_signal.entry_price` 作为 `mid` 的最小证据来源，而不额外引入新的市场数据接口。
- `InvestorProjection` / `SignalProjection` 先走 query-time derived projection，不新增新的 domain event。
- `profit_target_reached` 首版允许基于账户快照触发，而不是引入新的 mark-to-market 引擎。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-capital-system-completion/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 不改 transfer controller / transfer 协议，不重做 daily burn 与 live transfer 已完成主链。
- 不新增新的 SQL schema；本轮重点是 core projection / event planner / query 面完善。
- 不一次性把 multi-account / multi-currency / full capital ledger 全塞进 reconciliation；先做最小可行升级。

## 风险分级

- **等级**：High
- **标签**：`continue` `epic` `risk:high` `capital`
- **理由**：本轮触及资本系统剩余核心语义：buffer、内冲抵、利润告警、投资者/信号聚合视图与对账边界。它们相互耦合，且任何无痕状态变化都可能破坏 replay 一致性，因此必须先经 RFC 收敛再实现。

## 要点

- 先补资本系统最缺的可解释性，再补完整性
- 尽量让新增能力落在 core helper / reducer / query 层，而不是继续在 app 层打补丁
- 对账只推进一步，不一口吃成全资本总账
- 任何新增 projection / alert / netting 都必须有回归测试支撑

## 范围

- `.legion/tasks/signal-trader-capital-system-completion/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `.legion/playbook.md`

## Design Index

- 根 RFC 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- daily burn 已实现任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/plan.md`
- funding transfer 已实现任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-funding-transfer/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-capital-system-completion/docs/rfc.md`

## 最小实现边界

- 包含：buffer 最小闭环、internal netting 最小闭环、profit target alert、investor/signal query、reconciliation 小步升级、测试与文档。
- 暂不包含：完整资本总账、多账户统一资金池、多币种资本调度、复杂 transfer-settlement 真相模型。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 14:25_
