# signal-trader-daily-transfer-allocation

## 目标

把 signal-trader 的 `daily_burn_amount` 语义改成真实的固定日拨资金到 `trading_account`，无论下单与否，并交付完整 Legion 文档。

## 问题定义

- 当前实现把 `daily_burn_amount` 做成了“预算每天释放 + 下单前按需补资”。这会导致：
  - 不下单时不会发生真实资金划拨
  - `funding_account` / `trading_account` 语义与用户目标不一致
  - runtime transfer 仍然围绕“当前风险所需余额”补资，而不是“每日固定资本投放”
- 用户已经明确指出目标是：**无论下单与否，funding account 每天都要向 trading account 固定划转一笔资金**。
- 因此本轮不是小修，而是要把 core logical accounts 与 app transfer 调度一起改成“daily tranche allocation”模型。

## 验收标准

- `daily_burn_amount` 真正对应 daily tranche：
  - D0 / D+1 / D+2 都会把固定额度从 funding 分配到 trading
  - 不依赖是否存在 `place_order`
- 逻辑账户语义改正：
  - `funding_account` 表示尚未拨入 trading 的剩余预算
  - `trading_account` 表示已经拨入 trading 的资本池（扣除 `precision_lock` 后）
  - `available_vc` 表示 `trading_account - current_reserved_vc` 的非负截断
- live / paper 都能在不下单时按天完成真实资金划拨：
  - live 通过 observer / runtime loop
  - paper 通过 boot / paper clock advance / submit 等入口收口
- `transfer-out` 不再把已分配到 trading 的日拨资本直接扫回 funding；只回收真正超过 `trading_account + buffer` 的 excess。
- 新增测试至少覆盖：
  - core：D0 / D1 / D2 的 funding/trading/available 语义
  - paper：不下单推进一天也会发生 transfer-in
  - live：observer 周期内不下单也会发生 transfer-in
  - close / flat 后不会把已分配本金立刻 sweep 回 funding
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 本轮仍复用既有 `transfer_order` / `transfer-controller`，不重做 transfer 协议。
- daily tranche 仍按固定 24h `DAY_MS` 推进。
- `trading_account` 首版定义为：`released_vc_total - precision_locked_amount`。
- `funding_account` 首版定义为：`vc_budget - released_vc_total`。
- `available_vc` 首版定义为：`max(0, trading_account - current_reserved_vc)`。
- 当 `current_reserved_vc > trading_account` 时，仍保留“不隐式缩仓、但禁止继续扩张”的 over-reserved 保护。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-daily-transfer-allocation/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `ui/signal-trader-web/**`
  - `.legion/playbook.md`
- 不新增数据库 schema。
- 不重写 front-end 架构；只做必要同步。
- 不取消已有 paper clock / formal quote / capital query 能力，要在其上继续工作。

## 风险分级

- **等级**：High
- **标签**：`continue` `risk:high` `capital` `transfer`
- **理由**：这会同时改变 logical account 语义、transfer 调度与 live/paper 运行态行为，直接影响资金流向与人类对资本状态的理解，必须经 RFC 与测试闭环后再合入。

## 要点

- `daily_burn_amount` 变成真实日拨资本，不再只是账面释放
- `funding_account` / `trading_account` 改成“未拨 / 已拨”语义
- 不下单也要发生 daily transfer
- sweep 只回 excess，不回已分配本金

## 范围

- `.legion/tasks/signal-trader-daily-transfer-allocation/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `ui/signal-trader-web/**`
- `.legion/playbook.md`

## Design Index

- daily burn 任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/plan.md`
- funding transfer 任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-funding-transfer/plan.md`
- paper time control 任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/rfc.md`

## 最小实现边界

- 包含：core logical account 语义调整、runtime daily allocation sync、paper/live 测试、前端最小同步、任务文档。
- 暂不包含：full capital ledger、multi-account planner、复杂回收策略重写。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 17:45_
