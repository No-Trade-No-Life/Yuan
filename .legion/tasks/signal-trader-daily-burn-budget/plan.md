# signal-trader-daily-burn-budget

## 目标

补齐 signal-trader 的 `daily_burn_amount` lazy-evaluate 预算释放语义，使 paper 与 live 在同一 core 规则下支持按天释放 VC，并交付完整 Legion 文档。

## 问题定义

- 根 RFC 已经冻结了 `daily_burn_amount * elapsed_days(now - last_budget_eval_at)` 的预算释放语义，但当前实现只把字段接进了 runtime/config/snapshot，未真正进入 command、query 与 reconciliation 主链。
- 当前 `available_vc` 只会被 reducer 初始化，并按 `vc_budget - reserved` 近似计算；`last_budget_eval_at` 只记录不推进，`daily_burn_amount` 对 paper/live 都没有实际影响。
- 结果是：
  - 用户无法在 paper test 中通过“推进到下一天”观察 VC 释放
  - live 与 paper 都只能使用一次性静态 VC，而不是按天滚动释放的预算窗口
  - RFC 与实现产生漂移，后续关于 runtime 风控、projection 与 UI 的心智都会继续错位

## 验收标准

- `daily_burn_amount` 在 `libraries/signal-trader` 中真正生效：
  - `dispatchCommand` 前会按 `state.clock_ms` lazy-evaluate 预算
  - `queryProjection` 时会按 `state.clock_ms` lazy-evaluate 预算
  - `capture_authorized_account_snapshot` 的 projected balance 口径与新预算语义一致
- sizing 不再直接吃静态 `vc_budget`，而是基于“当前已释放的有效 VC”计算目标仓位；已有持仓时，跨天新增释放额度能够体现在下一次信号计算里。
- paper 与 live 共用同一 core 预算语义；app 层只负责把“当前时间”正确传入 core，而不复制预算公式。
- 新增测试至少覆盖：
  - core：D0 / D1 / D2 跨天释放预算的 library 单测
  - app：paper 与 live manager/queryProjection/submitSignal 的跨天回归测试
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 预算释放语义仍以根 RFC 为准，不重开另一套预算模型；本次只补齐已定义但缺失的行为。
- 为了让“按天分配 VC”在当前最小模型里可用，本次采用以下实现假设：
  - `available_vc` 表示当前已释放、且尚未被当前 target risk 占用的可用 VC
  - `effective_vc_budget = available_vc + current_reserved_vc`
  - `released_vc_total` 以 full-day lazy-evaluate 方式按 `daily_burn_amount` 增长，并以 `vc_budget` 为上限
  - 新 subscription 在创建日立即拿到首日 tranche：`min(vc_budget, daily_burn_amount)`
- “天”按固定 24h 窗口计算（`86_400_000 ms`），而不是按本地时区日历日切换。
- 当前 scope 不引入真实 funding/trading account 持久化表，只在现有 projection 字段上把 lazy-evaluate 落地为可用行为。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-daily-burn-budget/**`
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- paper 与 live 必须共用同一 core 规则，不能分别在 app 层实现两套预算算法。
- 不为此引入新的数据库 schema；预算释放仍必须由事件流 + projection + query lazy-evaluate 推导。
- 用户已明确“安全考虑可以弱化”，因此本轮优先把功能闭环、时间可测与 paper/live 一致性补齐，不额外扩大高强度安全边界改造范围。

## 风险分级

- **等级**：High
- **标签**：`continue` `risk:high` `paper` `live`
- **理由**：该改动直接影响 paper/live 的目标仓位、可用 VC、对账口径与跨天行为；虽然不是新的外部接口，但会改变 live runtime 的核心资金/风控语义，必须以 task-local RFC 收敛并补齐 review/test，避免 budget 漂移或 replay 不一致。

## 要点

- 补的是 RFC 已定义但当前缺失的预算释放，不是另起炉灶重做 signal-trader 风控
- `dispatchCommand` / `queryProjection` / `capture_authorized_account_snapshot` 三条主链必须统一吃同一 lazy-evaluate 结果
- 需要把“当前时间”稳定传到 core，并让测试能可靠推进到 D+1 / D+2
- 首版接受安全 review 强度弱化，但不接受 paper/live 预算语义分叉

## 范围

- `.legion/tasks/signal-trader-daily-burn-budget/**`
- `libraries/signal-trader/**`
- `apps/signal-trader/**`
- `.legion/playbook.md`

## Design Index

- 根 RFC 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 既有 core 任务：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/plan.md`
- 既有 app 任务：`/Users/c1/Work/signal-trader/.legion/tasks/app-signal-trader-live-integration/plan.md`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-burn-budget/docs/rfc.md`

## 最小实现边界

- 包含：core budget helper、dispatch/query lazy-evaluate、budget-aware sizing、paper/live 测试控时、任务级文档与报告。
- 暂不包含：新的资金账户表、transfer 指令、UI 控时入口、复杂 settlement 流程。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-22 | 最后更新: 2026-03-22 15:04_
