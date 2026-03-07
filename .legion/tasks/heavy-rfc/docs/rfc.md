# RFC: live-trading V1 信号驱动执行核心库（Heavy）

> **Profile**: RFC Heavy (Epic/High-risk)
> **Status**: Draft
> **Owners**: heavy-rfc task / 人类评审
> **Created**: 2026-03-05
> **Last Updated**: 2026-03-07

---

## Executive Summary（<= 20 行）

- **Problem**: 需要将会议已拍板的交易执行共识收敛成可实现且可审计的 V1 设计，避免实现阶段分歧与返工。
- **Decision**: 采用单一 core lib（纯计算内核）+ 外置 ports/effects 架构；输入为 push，信号仅 `{-1,0,1}`。
- **Risk boundary**: 库内禁止运行时副作用（DB/网络/消息/进程）；所有下单/审计/通知由宿主系统消费 `planned_effects` 执行。
- **Core semantics**: 仓位公式冻结为 `Position_i = floor_to_lot( VC_i / (stop_loss_ref_pct * price_ref * contract_multiplier) )`，`TotalPosition = Σ Position_i`。
- **Execution semantics**: V1 signal flip 默认 `close_then_open`，且下单必须同时挂 TP/SL。
- **Hard reject**: 明确禁止“预支未来 VC”；VC 不足时只允许“记账 + 通知 + 审计”，不允许无限透支。
- **Data model**: 投资者状态按人独立维护，执行层可合仓，归因与结算必须可反拆回投资者维度。
- **Rollout**: 本次仅 docs-only Draft PR；Merge 视为设计批准，merge 后评论 `continue` 才进入实现 Milestones。
- **Rollback**: 任一风险指标越阈值即切回 `audit_only`，停止新开仓，保留完整审计链路用于复盘与状态重建。

---

## 1. Background / Motivation

- 当前任务为 `stage=design-only`，需要把会议明确结论写成可执行的工程契约。
- 风险等级为 High：错误会直接影响资金安全、仓位边界与归因可追责性。
- 会议对 V1 边界已给出明确结论，继续口头推进会导致实现时语义漂移。
- 因此本 RFC 目标是“先冻结核心语义，再允许实现分阶段落地”。

## 2. Goals

- 固化 V1 输入与执行语义：push 信号、三值信号、`close_then_open`、下单即挂 TP/SL。
- 固化资金与仓位规则：以损定仓、VC 不足拒绝、不可预支未来 VC。
- 冻结 V1 风控口径：`stop_loss_ref_pct` 按 `signal_key` 统一，不允许投资者覆盖。
- 固化分账模型：投资者独立状态，执行可合仓，归因与结算可反拆。
- 固化审计能力：信号日志与下单日志必须可审计、可追踪、可重建。
- 固化工程边界：单一 core lib、无运行时副作用、可单测、可 mock。

## 3. Non-goals

- 本 RFC 不实现生产代码，不接交易所，不落库，不部署。
- V1 不支持连续信号强度（例如 `[-1, 1]` 浮点强度）。
- V1 不走传统基金份额制作为默认路径。
- 本轮不确定义实盘 `P95/P99/窗口/遗忘` 的最终风控口径（仅保留决策接口与 Open Questions）。

## 4. Constraints（硬约束）

- Compatibility / API contract:
  - 输入仅支持 `submit_signal` push 模式；`signal` 仅 `-1 | 0 | 1`。
  - V1 默认 `reverse_mode=close_then_open`，不支持 `atomic_reverse`。
  - 向后兼容策略采用 append-only 事件与“新增字段可选”。
- Performance / SLO:
  - 核心库在纯内存下单投资者单品种决策 P99 目标 `< 50ms`（不含外部 IO）。
  - burst 场景不允许丢失拒绝/失败审计事件。
- Security / privacy:
  - 风险参数变更与执行指令需权限分离。
  - 审计记录不得写入敏感密钥明文。
- Operational:
  - 执行失败不得阻塞审计事件输出。
  - 必须支持 `audit_only` 降级策略。
- Dependency / rollout constraints:
  - 仅交付 docs；Merge 作为设计批准门禁；后续以 Milestones 进入实现。

## 5. Definitions / Glossary

- `VC_i`: 投资者 `i` 可承受亏损的风险资金预算。
- `signal_key`: 业务信号键，用于定义同一策略/品种的风险参数与状态聚合口径。
- `signal_id`: 单次信号请求唯一标识，用于幂等去重与追踪。
- `stop_loss_ref_pct`: 止损参考比例，约束 `0 < stop_loss_ref_pct <= 1`。
- `Position_i`: 投资者 `i` 在当前信号下的目标仓位单位。
- `TotalPosition`: 执行层聚合仓位，`Σ Position_i`。
- `Signal flip`: 新信号方向与当前净持仓方向相反的情形。
- `core lib`: 仅包含确定性计算与状态转移，不执行任何运行时副作用。

---

## 6. Proposed Design（端到端）

### 6.1 High-level Architecture

- `SignalValidator`: 校验信号枚举、时间戳、幂等键。
- `PositionPlanner`: 基于每个投资者的 `VC_i` 与 `stop_loss_ref_pct` 计算 `Position_i`。
- `ExecutionPlanner`: 生成 `OrderIntent`（包含主单与 TP/SL）并应用 `close_then_open` 语义。
- `AttributionLedger`: 维护“执行可合仓、归因可反拆”的投资者账本映射。
- `AuditEmitter`: 输出信号、下单、拒绝、失败、结算等审计事件。
- `EffectPlanner`: 输出 `planned_effects`（place/cancel/audit/notify），由宿主系统执行。

### 6.2 状态机（V1）

- 主路径：`SignalReceived -> SignalAccepted -> PositionPlanned -> OrderIntentPlanned -> EffectsPlanned -> AwaitExecutionReport -> PositionSettled`。
- 拒绝路径：`SignalRejected`（非法输入/乱序/幂等冲突）、`RiskRejected`（VC 不足/参数越界/风控拒绝）。
- 补偿路径：`ExecutionFailed`（下单失败）、`ProtectionOrderMissing`（TP/SL 失败）进入 `CompensationRequired`。
- 并发约束：同 `investor_id + product_id` 串行；跨投资者可并行；合仓仅在执行层聚合，不影响分账状态隔离。

### 6.3 关键公式与业务语义

- 仓位计算：`Position_i = floor_to_lot( VC_i / (stop_loss_ref_pct * price_ref * contract_multiplier) )`
- 聚合仓位：`TotalPosition = Σ Position_i`
- 单位闭环：
  - `price_ref`：V1 固定为信号接收时的价格快照（由宿主系统写入 command）。
  - `contract_multiplier`：品种合约乘数；现货默认为 `1`。
- 执行语义：
  - `signal=1` 目标做多；`signal=-1` 目标做空；`signal=0` 必须平仓。
  - signal flip 默认 `close_then_open`：先平反向仓，再开新方向。
  - 下单意图必须包含主单与 TP/SL 保护单参数。
- VC 约束：VC 不足时不下单，必须记录拒绝账务并通知。

### 6.4 接口契约（核心库）

```ts
type SignalValue = -1 | 0 | 1;

interface SubmitSignalCommand {
  command_type: 'submit_signal';
  signal_id: string;
  signal_key: string;
  investor_id: string;
  product_id: string;
  signal: SignalValue;
  received_at: number;
  source: 'model' | 'manual' | 'agent';
}

interface DispatchResult {
  next_state: LiveTradingState;
  events: AuditEvent[];
  planned_effects: PlannedEffect[];
}

// frozen V1 API
// createLiveTradingState(seed?)
// dispatchCommand(state, command): DispatchResult
// queryInvestorState(state, { investor_id })
// queryAuditTrail(state, query)
```

### 6.5 Data model / schema（字段与兼容）

- `InvestorState`:
  - `investor_id`, `vc_budget`, `open_position_qty`, `last_signal_at`, `policy_version`。
  - 说明：状态按投资者独立保存，不共享份额池。
- `SignalDefinition`:
  - `signal_key`, `product_id`, `stop_loss_ref_pct`, `contract_multiplier`, `policy_version`。
  - 说明：V1 `stop_loss_ref_pct` 在信号层冻结，投资者层不覆盖。
- `ExecutionAggregate`:
  - `product_id`, `total_position_qty`, `attribution_map`（`investor_id -> qty`）。
  - 说明：执行可合仓，但必须携带可逆归因映射。
- `AuditEvent`:
  - 最低字段：`event_id`, `event_type`, `signal_id`, `signal_key`, `investor_id`, `product_id`, `created_at`, `payload`。
- 兼容策略：
  - 事件 append-only；新增字段仅增不删；未知字段读取端忽略。
  - `schema_version` 由写入端固定并随里程碑升级。

### 6.6 Error semantics（可恢复性 / 重试）

- 不可恢复错误（拒绝并审计，不重试）：
  - 非法信号值、`stop_loss_ref_pct` 越界、幂等冲突、VC 不足。
- 可恢复错误（允许重试，幂等保护）：
  - 外部执行端口超时、临时拒单、通知通道短暂不可用。
- 幂等语义：
  - `signal_id` 作为全局幂等键；同键同 payload 为重复提交（返回已处理）；同键不同 payload 为冲突错误。
- 参数口径语义：
  - `stop_loss_ref_pct` 由 `signal_key` 决定；投资者层仅提供 `VC_i`，不覆盖该参数。
- 审计语义：
  - 任一失败必须产生对应审计事件；“执行失败不影响审计输出”是硬约束。

---

## 7. Alternatives Considered（>= 2）

### Option A: 单体直接下单（无显式 effects）

- Pros: 代码路径短、初期实现快。
- Cons: 状态与副作用耦合，单测困难，失败补偿复杂。
- Why not: 放弃可审计可回放能力，不满足 High-risk 可追责要求。

### Option B: 分层状态机 + effects 外置（Chosen）

- Pros: 核心可单测、可 mock、可回放，失败补偿路径清晰。
- Cons: 初期接口设计成本更高，需严格约束状态与事件。
- Why chosen: 同时满足会议已拍板的“审计必备 + core lib 无副作用”。

### Option C: 全量事件溯源 + CQRS

- Pros: 历史重建与审计最强。
- Cons: 复杂度和交付成本高，超出本轮设计目标。
- Why not: 放弃短期可落地性，不利于先完成 V1 设计闭环。

### Decision

- 选择：Option B。
- 放弃了什么：
  - 放弃 Option A 的实现速度与低认知负担。
  - 放弃 Option C 的一步到位全量追溯能力。

---

## 8. Migration / Rollout / Rollback（强制）

### 8.1 Migration Plan

- 是否有数据迁移：否（本次 docs-only）。
- 步骤：
  1. 提交 docs-only Draft PR。
  2. PR Merge 作为“设计批准”。
  3. merge 后在 PR 评论 `continue`，按 Milestones 进入实现。
- Backfill/双写策略：当前无双写；后续若接入生产存储另开迁移 RFC。

### 8.2 Rollout Plan

- Feature flags（宿主系统持有）：
  - `live_trading.enabled`
  - `live_trading.execution_mode = audit_only | paper | live`
  - `live_trading.reverse_mode = close_then_open`（V1 冻结）
- 灰度：`audit_only -> paper -> live(白名单)`。
- 验收指标：
  - `audit_event_completeness`
  - `idempotency_conflict_rate`
  - `tp_sl_attach_success_rate`
  - `vc_insufficient_reject_rate`

### 8.3 Rollback Plan（可执行）

- 触发器（任一满足即回滚）：
  - `audit_event_completeness < 100%`（1m）
  - `tp_sl_attach_success_rate < 99.9%`（5m）
  - `idempotency_conflict_rate > 0.1%`（5m）
  - 出现 `unbounded_vc_usage` 事件（即时）
- 回滚步骤：
  1. 切 `execution_mode` 到 `audit_only`。
  2. 停止新开仓 effect，只保留审计与通知 effect。
  3. 对在途订单执行查单/撤单补偿。
  4. 以审计事件重建状态并输出 incident 报告。

---

## 9. Observability（强制）

- Logs:
  - 关键字段：`trace_id`, `signal_id`, `investor_id`, `product_id`, `policy_version`, `event_type`, `error_code`。
  - 采样策略：成功低采样；拒绝/失败 100% 全量。
- Metrics:
  - `signal_accept_rate`, `signal_reject_rate`
  - `order_effect_emit_rate`, `order_effect_fail_rate`
  - `tp_sl_attach_success_rate`
  - `vc_insufficient_reject_count`
  - `audit_event_completeness`
- Alerts:
  - 审计缺口、TP/SL 挂单失败率超阈值、幂等冲突突增、VC 异常使用。
- Debug playbook:
  - 从 `signal_id` 追踪 `Signal* -> OrderIntent* -> ExecutionReport* -> Settlement*` 全链路。

---

## 10. Security & Privacy（强制）

- Threat model:
  - 伪造/重放信号、越权改风控、恶意 burst 导致资源耗尽。
- 权限边界:
  - 信号提交与策略更新分权；高风险变更需审批流。
- 输入校验:
  - 强校验 `signal` 枚举、时间戳窗口、`stop_loss_ref_pct` 与 `VC` 数值边界。
- 资源耗尽防护:
  - 每投资者每品种限流与冷却；队列超限时降级 `audit_only`。
- Secrets 与数据保留:
  - 不记录敏感密钥明文；审计保留周期由合规策略确定（见 Open Questions）。

---

## 11. Testing Strategy（强制）

- Unit tests:
  - 仓位公式与 `floor_to_lot` 边界。
  - `close_then_open` 与 `signal=0` 平仓语义。
  - VC 不足拒绝与通知 effect 输出。
- Integration tests（mock ports）:
  - 下单必须附带 TP/SL。
  - 执行可合仓且归因可反拆。
  - 幂等重放与幂等冲突路径。
- Regression tests:
  - 不允许“预支未来 VC”回归测试。
  - 三值之外信号拒绝回归测试。
- Manual validation:
  - 单个 `signal_id` 审计追踪演练，验证可追责。

---

## 12. Milestones（可验收最小增量，强制）

- Milestone 1: 设计冻结（docs-only）

  - Scope: 完成 research + RFC 评审并合并。
  - Acceptance: PR merge；争议项只保留 Open Questions。
  - Rollback impact: 文档回滚，无运行影响。

- Milestone 2: core engine 纯库实现

  - Scope: 实现 `createLiveTradingState/dispatchCommand/query*`，不含任何 runtime side effects。
  - Acceptance: 纯内存下稳定产出 `next_state + events + planned_effects`。
  - Rollback impact: 可回退到前一纯库版本。

- Milestone 3: ports + mock runner

  - Scope: 定义 `ExecutionPort/AuditPort/NotifyPort/ClockPort/IdPort` 并完成 mock 验证。
  - Acceptance: 通过 TP/SL、幂等、VC 拒绝、合仓归因等关键链路测试。
  - Rollback impact: 回滚接口版本，不破坏核心状态模型。

- Milestone 4: 集成指南与灰度手册
  - Scope: 文档化 `audit_only -> paper -> live` 接入流程与回滚动作。
  - Acceptance: 集成方可按手册接入且不引入 core lib 副作用。
  - Rollback impact: 文档级回滚。

---

## 13. Open Questions（仅阻塞级）

- [ ] 实盘阶段何时从“历史最大单笔浮亏”迁移到 `P95/P99/窗口/遗忘` 口径？
- [ ] 交易账户“慢慢打钱”的默认节奏参数（单次上限/频率）如何定义？
- [ ] “至少打一手基本手”是否纳入 V1 默认，还是作为实验开关后置？
- [ ] 审计日志保留周期与导出合规格式由谁审批并何时冻结？

---

## 14. Implementation Notes（落地提示）

- 本 RFC 明确：当前是 docs-only Draft PR；Merge 视为设计批准。
- merge 后在 PR 评论 `continue`，进入实现里程碑；未评论前不进入代码阶段。
- 预计实现文件（后续阶段）：
  - `libraries/live-trading/src/engine/create-live-trading-state.ts`
  - `libraries/live-trading/src/engine/dispatch-command.ts`
  - `libraries/live-trading/src/engine/query-investor-state.ts`
  - `libraries/live-trading/src/engine/query-audit-trail.ts`
  - `libraries/live-trading/src/domain/position-planner.ts`
  - `libraries/live-trading/src/domain/execution-planner.ts`
  - `libraries/live-trading/src/domain/attribution-ledger.ts`
  - `libraries/live-trading/src/ports/index.ts`
  - `libraries/live-trading/src/index.ts`

---

## 15. References（证据索引）

- Task brief: `.legion/tasks/heavy-rfc/docs/task-brief.md`
- Research: `.legion/tasks/heavy-rfc/docs/research.md`
- Inputs:
  - `whiteboard_exported_image.png`
  - `meetgraph_7612215548813921240_d41f0630-20a3-44d3-8dfb-79f0a030e21b.png`
