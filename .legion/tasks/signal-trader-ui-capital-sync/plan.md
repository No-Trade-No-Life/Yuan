# signal-trader-ui-capital-sync

## 目标

把独立前端 `ui/signal-trader-web` 同步到最新后端资本系统能力，补齐 capital 视图与相关交付文档。

## 问题定义

- 后端这几轮已经补齐了多项资本系统能力：`funding_account`、`trading_account`、`precision_locked_amount`、`investor/signal` projection、account-scoped `profit_target_reached` advisory、formal quote source、internal netting 证据与更细的 reconciliation。
- 但独立前端仍停留在早期控制台形态，只显示 `product` / `subscription` / `reconciliation` 三块原始 projection，没有把这些新增能力变成可读的操作视图。
- 结果是：用户虽然已经有后端能力，但仍然要翻事件流和审计日志才能理解资本状态，前端没有真正跟上产品化能力。

## 验收标准

- 前端类型与 API 同步到后端最新能力，至少支持：
  - `funding_account`
  - `trading_account`
  - `precision_locked_amount`
  - `investor` projection
  - `signal` projection
  - reconciliation explanation / tolerance / difference
- 页面新增清晰的 capital 视图，不再只是原始 JSON：
  - 资金分层（released/funding/trading/precision lock）
  - investor / signal 聚合视图
  - formal quote source / internal netting 证据
  - profit target advisory 与 quote fail-close 诊断
- 仍保留原始 projection / event / audit 视图，方便深查。
- 前端在提交信号时不会传入或信任 `reference_price*`，而是继续由后端 worker 注入正式价格证据。
- 至少完成前端 build 与 paper Playwright 冒烟验证。
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 独立前端继续复用现有单页控制台，不重构成多路由应用。
- 本轮优先把最新后端能力“展示清楚”，而不是引入新的写入动作。
- `investor` / `signal` projection 以现有后端 query 面为准，不额外要求后端继续扩字段。
- capital 视图以“summary + raw JSON”双层呈现，既要能扫读，也要便于排障。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-ui-capital-sync/**`
  - `ui/signal-trader-web/**`
  - `.legion/playbook.md`
- 不改后端 schema / signal-trader core 协议；本轮只做前端同步。
- 保持独立前端的产品化风格，不退回成 bland JSON 面板墙。

## 风险分级

- **等级**：Medium
- **标签**：`continue` `ui` `capital`
- **理由**：这是前端同步任务，不直接改资金写链，但它会影响用户对资本系统状态的理解与操作判断，因此需要设计收敛与最小验证。

## 要点

- 前端要把新后端能力变成“看得懂”的控制台，而不是继续靠原始事件流排障
- capital / investor / signal / formal quote / advisory 必须同步展示
- 写区继续保持 fail-close，不让前端覆盖后端正式价格证据
- 继续维护独立前端项目，不回接 `ui/web`

## 范围

- `.legion/tasks/signal-trader-ui-capital-sync/**`
- `ui/signal-trader-web/**`
- `.legion/playbook.md`

## Design Index

- 独立前端任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-standalone-ui/plan.md`
- capital 后端任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-capital-system-completion/plan.md`
- formal quote source 任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-formal-quote-source/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-ui-capital-sync/docs/rfc.md`

## 最小实现边界

- 包含：类型/API 同步、capital 视图、investor/signal 视图、formal quote / advisory 证据展示、build + paper Playwright、任务文档。
- 暂不包含：新的前端写操作、复杂图表、资金动画、后端 schema 改动。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-23 | 最后更新: 2026-03-23 16:10_
