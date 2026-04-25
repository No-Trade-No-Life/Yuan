# signal-trader

## 目标

基于 `signal-trader-rfc-v1-事件溯源重排版.md` 交付一个可编译、可测试、可重放的 `libraries/signal-trader` V1 核心库，并产出完整 Legion 任务文档、验证报告与可直接用于 PR 的描述材料。

## 问题定义

- 仓库中尚不存在 `signal-trader` 共享库，但根目录 RFC 已冻结了 V1 的事件溯源语义、核心 API、关键约束与验收方向。
- 当前缺的是一个最小可用、与 RFC 一致的 core lib：能够承载事件 schema、订阅/信号命令、reducer/replay、查询接口、execution effect 规划与 mock execution port。
- 如果没有这层库，后续宿主接入、审计重放、测试样例与 paper/live rollout 都无法围绕统一契约推进。

## 验收标准

- `libraries/signal-trader` 作为新的 Rush project 存在，且能被 monorepo 识别与构建。
- 对外暴露 RFC 中冻结的最小 V1 API：`createEventSourcedTradingState`、`dispatchCommand`、`appendEvents`、`replayEvents`、`queryProjection`、`queryEventStream`、`applyExecutionEffects`、`createMockExecutionPort`。
- 至少覆盖以下核心语义：
  - `submit_signal` 生成 `SignalReceived`，并按订阅产生 `IntentCreated` / `IntentRejected`
  - 新增风险暴露必须校验 `stop_loss_price`
  - `direction=0` 即使空仓也保留成功审计事件
  - `apply_execution_report` 通过事件推进成交与账本投影
  - `capture_authorized_account_snapshot` 产生对账事件
  - 同一事件流 `replayEvents` 结果确定一致
- 生成 `<taskRoot>/docs/test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。

## 假设

- 以根目录 RFC 为唯一设计真源，不另起草新的重型 RFC，只在本任务中补摘要与实现取舍。
- 本轮先交付 production-grade core lib + mock，不接真实交易所、不落生产数据库、不实现宿主 service adapter。
- `planned_effects` 作为派生结果实现，真相仍由事件流与 reducer 保持。
- 账户/订单执行接口尽量复用 `@yuants/exchange` 的 `IExchange` 子集语义。

## 约束

- 文档语言使用中文；代码与公开类型命名沿用仓库现有 TypeScript 风格。
- Scope 仅限根 RFC、`.legion/tasks/signal-trader/**`、`libraries/signal-trader/**`、以及接入新 library 所必需的 monorepo 配置。
- 不引入 vendor 耦合；库层只实现领域模型、端口与 mock。
- 不绕过事件闭环直接修改 projection；任何状态变化必须可追溯到 event append。

## 风险分级

- **等级**：High
- **标签**：`rfc:heavy` `epic` `risk:high`
- **理由**：该库定义信号执行、分账、风控、对账和执行语义的基础抽象，属于高风险核心域；虽然本轮不接真实资金与交易所，但 API 与 reducer 一旦冻结会影响后续宿主接入与回放兼容，因此必须以 RFC 驱动并补做 RFC review / code review / security review。

## 要点

- 直接把 `signal-trader-rfc-v1-事件溯源重排版.md` 作为 RFC 主体纳入任务设计入口
- `plan.md` 只保留摘要级契约；详细设计与开放问题以根 RFC 为准
- 优先实现事件 schema、reducer、replay、query、effect planner 与 mock execution port 的闭环
- 先保证确定性与可测试性，再谈宿主集成与真实执行

## 范围

- `signal-trader-rfc-v1-事件溯源重排版.md`
- `.legion/tasks/signal-trader/**`
- `libraries/signal-trader/**`
- `rush.json`
- `common/config/rush/**`（仅在接入新 project 必要时）
- `pnpm-lock.yaml`（仅在新增依赖必要时）

## Design Index

- RFC 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 实现产物：`/Users/c1/Work/signal-trader/libraries/signal-trader/`
- 任务报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/`

## 最小实现边界

- 包含：事件类型定义、状态快照、命令处理、事件追加、replay、projection 查询、effect 规划、mock execution port、关键测试。
- 暂不包含：真实 EventStore 持久化、真实交易所适配器、宿主进程/服务注册、数据库 migration、复杂审批流。

## 阶段概览

1. **设计与任务落盘** - 2 个任务
2. **实现 signal-trader library** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-17 | 最后更新: 2026-03-17_
