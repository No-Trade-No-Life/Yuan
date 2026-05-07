# RFC: signal-trader V1 信号驱动执行核心库（Heavy）

> **Profile**: RFC Heavy (Epic/High-risk)  
> **Status**: Ready for Review  
> **Owners**: signal-trader task / 人类评审  
> **Created**: 2026-03-05  
> **Last Updated**: 2026-03-17  

---

## Executive Summary（<= 20 行）

- **Problem**: 需要把会议已拍板的交易执行共识，与最新的事件溯源设计原则收敛成一份可实现、可审计、可重放的 V1 规范，避免实盘阶段出现“状态对了但无法解释”“分账对不上”“失败路径不可追责”的工程风险。
- **Decision**: V1 采用 **append-only 事件溯源架构**；系统事实以 `DomainEvent[]` 为准，projection / snapshot 只是 reducer 重放出来的派生状态，不再把 `next_state` 视为唯一真相。
- **Signal semantics**: raw signal 的最小语义仍是 `product_id + direction(-1|0|1)`；`direction=0` 为强语义，表示立即平当前目标并保持空仓。
- **Risk semantics**: Signal Trader 保留名义价值与目标仓位决策权；任何会导致新增风险暴露的 open / add intent，必须在 intent validation 阶段提供合法 `stop_loss_price`。
- **Stop-loss semantics**: V1 不在 core lib 中学习、观测或自动修改止损；`stop_loss_price` 只在新开仓 / 新增风险暴露时生效，持仓中不得原地修改。
- **Accounting grain**: 多投资者分账的 canonical key 升级为 `subscription_id`，而不是 `(investor_id, signal_key)`；一个投资者可对同一 signal 存在多条订阅。
- **Execution semantics**: 同品种多 signal / 多 subscription 在执行层按 `product_id` 做净额合并；完全内冲抵时记录 `MidPriceCaptured + InternalNettingSettled`，不强求外部成交。
- **Buffer semantics**: 残差、最小精度锁定金额、舍入差额进入投资者独立 `buffer_account`，不进入公共池；buffer 仍属于该投资者 VC 体系。
- **VC semantics**: VC 与预算窗口按账本 lazy-evaluate；真实 transfer 不是 core lib 主路径，只能由宿主 / 外部 settlement 接口执行。
- **Failure semantics**: 拒单、乱序、未知回报、执行失败都以“追加事件 + 补偿事件”表达，不做物理回滚。
- **Rollout**: 本次交付重点从“厚状态机”调整为“事件 schema + reducer + replay + mock execution + integration guide”闭环。
- **Rollback**: 任一可重放一致性、分账精度或对账指标越阈值，宿主立即切回 `audit_only`，停止产生新的执行 effect，仅保留事件、告警与快照捕获。

---

## 1. Background / Motivation

- 当前任务已进入 `stage=continue`，需要把会议明确结论与最新设计原则一起冻结到可实现的 V1 规范中。
- 早期方案更偏 `dispatchCommand -> next_state + planned_effects` 的 state-first 设计；它在纯内存测试上可行，但随着多投资者、多订阅、净额执行、失败补偿和账实核对引入后，单靠“当前状态对象”难以解释每一步为何发生。
- 最新设计原则进一步强调：**审计日志就是事件流，状态由 reducer 重放得到**；这要求我们把工程中心从“状态对象怎么演进”转成“事实事件如何追加、如何分层、如何重放”。
- 同时，会议已经明确：
  - 信号最小输入是方向信号，不接受连续强度；
  - 名义价值与目标仓位由 Signal Trader 决定；
  - 开仓必须具备硬止损边界；
  - 不允许预支未来 VC；
  - 投资者分账与隔离优先级高于实现简化；
  - 执行可合仓，但归因必须可反拆回投资者粒度；
  - 宿主负责真实下单、落库、部署与真实转账，不允许 core lib 绕过审计闭环直接改状态。
- 因此，本 RFC 的目标不是再堆厚一个“更复杂的状态机”，而是把 V1 收敛成：**事件是事实、projection 是读模型、effects 是派生物、审计与重放是一等公民**。

---

## 2. Goals

- 冻结 V1 的**事实来源**：append-only 事件流是唯一真实来源；projection / snapshot 仅用于查询、执行规划、对账和调试。
- 冻结 V1 的**最小信号语义**：signal provider 只表达方向与品种，不表达仓位大小、杠杆强度或名义价值。
- 冻结 V1 的**开仓风控约束**：任何导致新增风险暴露的 open / add intent 都必须带合法 `stop_loss_price`；缺失或非法则拒绝该 intent。
- 冻结 V1 的**止损变更约束**：持仓存续期内不允许通过同方向 signal 原地修改止损；变更仅能在下一次重新开仓时生效。
- 冻结 V1 的**分账粒度**：以 `subscription_id` 作为 canonical ledger key；投资者、signal、product 维度均由 projection 推导。
- 冻结 V1 的**残差归属**：残差不进入公共池，而进入投资者独立 `buffer_account`，并保留来源 `subscription_id` 审计链路。
- 冻结 V1 的**执行口径**：按 `product_id` 净额合并执行，优先保证成交；完全内冲抵时允许内部清算并记录 `mid` 价格证据。
- 冻结 V1 的**失败表达**：拒单与执行失败不删除历史，只追加事件与补偿事件；账本只由成交事实与内部清算事实驱动。
- 冻结 V1 的**预算口径**：VC 与 `daily_burn_amount` 驱动的预算窗口采用 lazy-evaluate；真实 transfer 不进入 core lib 真相模型。
- 冻结 V1 的**工程交付**：优先交付事件 schema、reducer、replay、一致性回归、ExecutionPort / mock，而不是继续加厚 command-state 分支。
- 保留会议已拍板的**投资者画像字段**：`daily_burn_amount`、`profit_target_value`、权限材料与账户锚点仍保留在 profile / subscription 中。
- 保留会议已拍板的**Fail-close 原则**：对账不一致、权限不足、硬止损缺失、未知回报等情况默认拒绝推进，并产出可审计事件。

---

## 3. Non-goals

- V1 不引入连续信号强度输入；信号仍仅支持 `-1 | 0 | 1`。
- V1 不把真实资金划转纳入 core lib 主路径；真实 transfer / settlement 仅在宿主侧发生。
- V1 不在 core lib 内做冷却、降频、抖动平滑等“策略行为修正”。
- V1 不在 core lib 内学习止损、观测历史最大浮亏或维护 P95 / P99 / 遗忘窗口类止损逻辑。
- V1 不把 `profit_target_value` 冻结成 core 自动平仓动作；命中目标后默认只发 `AlertTriggered(type=profit_target_reached)`，是否平仓由宿主显式提交 `direction=0` 或等价控制命令。
- V1 不把物理数据库、消息队列或存储选型写入 frozen API；只冻结事件语义与 reducer 行为。
- V1 不处理不支持原生硬止损能力的 live venue 自动降级；V1 对该类 venue 默认拒绝接入。
- V1 不把复杂审批流、跨产品组合优化、借贷、EA 联动、智能资金再平衡写入本轮验收范围。
- V1 不要求每笔订单原生附带 TP；止盈属于 investor / profile / host policy 语义，不属于 signal 本体强制字段。
- 本 RFC 对应实现不接真实交易所、不落库、不部署，但必须交付生产级 core lib、ExecutionPort 契约、mock、测试与报告。

---

## 4. Constraints（硬约束）

### 4.1 Compatibility / API contract

- 输入仅支持 push 模式；raw signal 仅 `-1 | 0 | 1`。
- `submit_signal` 仍为 signal-scoped；订阅关系通过注册态或 append-only 订阅事件维护，不要求上游为每个投资者重复发信号。
- `direction=0` 为强语义：即便当前无仓位，也必须追加成功事件，用于审计与链路健康验证。
- raw signal 不表达仓位大小、强度或名义价值。
- `stop_loss_price` 不属于 raw signal 的最小必要字段；但若某次 signal 导致任一 subscription 出现新增风险暴露，则对应 intent 在落地前必须通过 `stop_loss_price` 校验。
- 任一 open / add intent 生效后，持仓存续期内禁止原地修改该 intent 的 `stop_loss_price`；修改仅能在下一次重新开仓时生效。
- 时间确定性由 `state.clock_ms` 驱动；宿主初始化状态时显式注入时钟，`dispatchCommand` 不直接读取 wall clock。

### 4.2 Accounting constraints

- canonical ledger key 为 `subscription_id`。
- `subscription_id` 必须可投影回 `investor_id / signal_key / product_id`。
- 残差、最小精度锁定金额、舍入差额进入投资者独立 `buffer_account`，禁止流入公共池。
- 投资者即时撤资、暂停或关闭订阅带来的成本只由该投资者承担，不得跨投资者摊销。
- `buffer_account` 属于该投资者 VC 体系的一部分，不存在额外“并回 VC”的隐藏动作。
- 逻辑账本必须始终保留从 `subscription_id` 到 investor / signal / product 的归因路径，避免净额执行后丢失来源。

### 4.3 Execution constraints

- 同 `product_id` 的多 subscription 目标仓位必须先净额合并，再生成外部订单 delta。
- 完全内冲抵时允许不向外部 venue 下单，但必须记录 `MidPriceCaptured` 与 `InternalNettingSettled`。
- 当前阶段优先使用 marketable order / 市价成交，优先保证成交，再由成交事件修正账本。
- 下单成功与成交成功必须分离记录：执行事件与账本事件采用双轨制。
- V1 仅接入支持原生硬止损能力的执行环境；若执行端不支持，则拒绝接入而不是在库内偷偷降级。

### 4.4 Event sourcing constraints

- 审计日志 append-only，不做物理回滚。
- 同一事件流 + 同一 reducer 版本，必须得到确定性一致的 projection。
- 任何拒绝、失败、超时、未知回报都必须表现为事件，而不是“悄悄没有状态变化”。
- `planned_effects` 不是事实来源，必须可由 `appended_events + next_snapshot` 完整推导。
- snapshot 可以丢弃后重建，事件流不能丢。
- 事件 schema 采用 append-only 兼容策略：新增字段仅增不删，读取端忽略未知字段。

### 4.5 Operational constraints

- VC 与预算窗口允许 lazy-evaluate（信号触发、订阅变更、查询、定时等），优先账本计算，不把频繁 transfer 作为主路径。
- 宿主必须支持 `audit_only` 降级策略。
- 执行失败不得阻塞事件追加与告警事件输出。
- 资金账户与交易账户之间的真实划转由宿主 / 外部接口负责；core lib 只维护账本、计划与审计语义。
- 外部授权账户快照是权威来源；projection 若无法与快照对齐，必须追加 `ReconciliationMismatchDetected` 并 fail-close 到 `audit_only`。
- burst 场景不允许丢失拒绝 / 失败 / 对账异常事件。

### 4.6 Security / privacy constraints

- 风险参数变更与执行指令需权限分离。
- 审计记录不得写入敏感密钥明文。
- 未注入授权回调时，`update_risk_policy` 与订单 effect 一律 fail-close。
- 所有高风险修改都必须保留可追溯的 `auth_context`。

---

## 5. Definitions / Glossary

- `signal_key`: 业务信号键，用于定义共享 signal 的注册态与订阅聚合口径。
- `signal_id`: 单次 signal 提交唯一标识，用于幂等去重与追踪。
- `subscription_id`: V1 canonical 分账粒度；表示一个投资者对某个 signal 的一条独立跟随关系。
- `entry_price`: 由宿主在提交 signal 时附带的价格快照；若某次 signal 会导致新增风险暴露，则必须在 `submit_signal` 时显式提供，不允许事后补填。
- `stop_loss_price`: 开仓 / 加仓时显式提供的止损点位；做多必须小于 `entry_price`，做空必须大于 `entry_price`。
- `VC_sub`: 单个 subscription 在当前时点可承受亏损的风险资金预算。
- `daily_burn_amount`: 某 subscription 的日消耗 / 日资金投放速率，用于预算释放的 lazy-evaluate。
- `profit_target_value`: 某 subscription 或 investor profile 的固定绝对金额目标；V1 默认只触发告警，不自动平仓。
- `funding_account`: 逻辑资金账户，用于表示尚未投入交易风险暴露的预算。
- `trading_account`: 逻辑交易账户，用于表示已用于当前交易风险暴露的预算。
- `buffer_account`: 投资者独立缓冲池，用于承接最小精度、舍入、残差与暂不可提现金额。
- `SignalReceived`: raw signal 被系统接收并盖时间戳后的审计事件。
- `IntentCreated`: 某个 subscription 基于当前 signal 与账本状态生成的目标意图事件。
- `IntentReleased`: 某个未成交 / 被拒 intent 所占用的风险预算被释放的补偿事件。
- `ProductExecutionProjection`: 按 `product_id` 聚合后的执行视图，用于计算外部订单 delta。
- `SubscriptionLedgerProjection`: 按 `subscription_id` 的仓位、VC、buffer 与已实现盈亏投影视图。
- `InternalNettingSettled`: 多 subscription 完全内冲抵时，不发生外部成交而完成的一次内部清算事件。
- `MidPriceCaptured`: 内部清算所采用的盘口 `mid` 价格及其来源证据事件。
- `Projection`: 由 reducer 从 append-only 事件流重放得到的派生状态，不是事实本体。
- `AuditProjection`: 用于查询审计链路的读模型，帮助从 `signal_id / subscription_id / order_id` 追溯全链路。
- `authorized_account_snapshot`: 宿主从真实授权账户读到的权威余额 / 权益快照；内部 projection 最终必须可与其对账。

---

## 6. Proposed Design（端到端）

### 6.1 High-level Architecture

- `CommandHandler`: 接收命令并做最小校验，不直接修改 canonical state。
- `SubscriptionRegistry`: 维护 `subscription_id -> investor_id / signal_key / product_id / profile` 的注册态与订阅生命周期。
- `IntentPlanner`: 根据 `SignalReceived`、订阅关系、风控参数和当前 projection，为每个 `subscription_id` 生成 `IntentCreated` 或拒绝类事件。
- `PositionPlanner`: 基于 `VC_sub`、`entry_price`、`stop_loss_price` 与 `contract_multiplier` 计算 `TargetPosition_sub`。
- `ProductNettingPlanner`: 将所有活跃 subscription 的目标仓位按 `product_id` 净额聚合，生成外部执行 delta。
- `ExecutionEffectPlanner`: 从新增事件与当前 projection 推导 `planned_effects`；effect 是派生物，不是事实来源。
- `EventStore`: 追加 `DomainEvent[]`；append-only，是唯一事实来源。
- `Reducer`: 从事件流重放出 `SubscriptionLedgerProjection / InvestorProjection / ProductExecutionProjection / AuditProjection / ReconciliationProjection`。
- `BufferLedger`: 维护投资者独立缓冲池余额、锁定金额与来源事件链。
- `ReconciliationProjector`: 用授权账户快照和内部 projection 做核对，发现偏差时只追加 mismatch 事件，不直接改历史。
- `AuditEmitter`: 输出信号、拒绝、执行、内冲抵、对账、权限失败等结构化事件，供宿主落库、告警与回放。

### 6.1.1 本轮编码边界（冻结）

- 本轮 `libraries/signal-trader` 只冻结四条命令主链：
  - `upsert_subscription`
  - `submit_signal`
  - `apply_execution_report`
  - `capture_authorized_account_snapshot`
- `update_risk_policy`、复杂资金账户查询面、宿主 service adapter、真实 EventStore / DB / MQ 均不属于本轮 frozen API。
- `InternalNettingSettled` / `MidPriceCaptured` 仍保留在 RFC 语义中，但实现上属于可选里程碑；若首版未落地，不阻塞 core lib 的事件闭环交付。

### 6.2 Event flow（V1，替代厚状态机）

#### 6.2.1 信号进入

- `submit_signal`
- -> `SignalReceived`
- -> 对所有匹配 `signal_key` 的活跃 `subscription_id` 生成：
  - `IntentCreated`
  - 或 `IntentRejected(reason=...)`

#### 6.2.2 开仓 / 加仓校验

- 若 intent 导致新增风险暴露，则必须同时通过 `entry_price + stop_loss_price` 校验；两者均在 `submit_signal` 时提供。
- 校验失败：
  - `IntentRejected(reason=missing_or_invalid_entry_or_stop_loss)`
  - `AlertTriggered(type=risk_rejected)`
- 已有持仓时，若同方向 signal 试图修改止损：
  - `IntentRejected(reason=stop_loss_mutation_forbidden)`

#### 6.2.3 执行路径

- `IntentCreated`
- -> `OrderSubmitted`
- -> `OrderAccepted | OrderRejected | ExecutionTimeoutObserved`
- `OrderRejected`
- -> `IntentReleased`
- -> `AlertTriggered(type=order_rejected)`
- `ExecutionTimeoutObserved`
- -> 保留待查状态，不改持仓账本，只允许宿主按幂等键重试 effect

#### 6.2.4 成交路径

- `OrderAccepted`
- -> `OrderFilled`（允许 partial）
- -> reducer 重放更新 `SubscriptionLedgerProjection / ProductExecutionProjection / AuditProjection`
- -> 如达到告警阈值：
  - `AlertTriggered(type=profit_target_reached | risk_budget_low | abnormal_reject_spike)`

#### 6.2.5 内冲抵路径

- 若 product 级净额合并后无需向 venue 产生外部订单，但 subscription 级别存在相互抵消：
- -> `MidPriceCaptured`
- -> `InternalNettingSettled`
- -> reducer 重放更新相关 projection

#### 6.2.6 强制空仓路径

- `direction=0`
- -> `SignalForcedFlatHandled`
- -> 如有外部 delta，则继续走 `OrderSubmitted -> ...`
- -> 如本来已空仓，仍保留 `SignalForcedFlatHandled` 成功事件，不视为 no-op

#### 6.2.7 订阅 / 画像更新路径

- `upsert_subscription`
- -> `SubscriptionUpdated`
- -> 触发预算 lazy-evaluate 与 projection 刷新
- -> 若订阅关闭或暂停导致需释放 intent / 调整账本，追加对应补偿事件

#### 6.2.8 对账路径

- `capture_authorized_account_snapshot`
- -> `AuthorizedAccountSnapshotCaptured`
- -> `ReconciliationMatched | ReconciliationMismatchDetected`
- mismatch 后 projection 进入 `audit_only`
- V1 最小闭环只比较单账户单标量：`projected_balance` vs `observed_balance(balance)`

### 6.3 关键公式与业务语义

#### 6.3.1 仓位与净额

- 单个 subscription 的目标仓位：

```text
TargetPosition_sub =
  floor_to_lot(
    VC_sub / (abs(entry_price - stop_loss_price) * contract_multiplier)
  )
```

- Product 执行目标：

```text
ProductTargetQty = Σ SignedTargetPosition_sub (for active subscriptions on same product_id)
```

- 外部订单 delta：

```text
ExternalOrderDelta = ProductTargetQty - CurrentProductNetQty
```

#### 6.3.2 成交反拆与分摊

- 成交反拆：

```text
FillShare_sub =
  floor_to_lot(
    fill_qty * abs(SignedTargetPosition_sub) / Σ abs(SignedTargetPosition_sub)
  )
```

- 滑点、手续费、已实现盈亏按同一分摊基准分配。
- 余数按稳定顺序（`subscription_id`）分配；剩余无法落到最小精度的金额进入投资者 `buffer_account`。
- `buffer_account` 变动必须携带 `source_subscription_id` 与来源事件 ID，保证可回放与可追责。

#### 6.3.3 VC / 预算 / 资金调度

- `available_vc` 是 projection 字段，不是单独维护的真相表。
- 预算释放采用 lazy-evaluate：

```text
budget_release =
  daily_burn_amount * elapsed_days(now - last_budget_eval_at)
```

- 每次 `dispatchCommand` / 显式 query / 定时触发时补算新增可投额度。
- 真实 transfer 只由宿主根据 projection 的差额和策略需要执行；core lib 不以 transfer ack 作为主路径真相。

#### 6.3.4 止损 / 止盈 / 预支约束

- `stop_loss_price` 是 open / add intent 的硬校验输入。
- 对任何新增风险暴露的 intent，`entry_price` 与 `stop_loss_price` 必须同时在 `submit_signal` 时给出。
- 已有持仓时，不允许通过同方向 signal 原地修改止损；需要显式重新开仓才能生效。
- `profit_target_value` 只影响告警与宿主决策，不在 core 中自动触发平仓。
- 不允许“预支未来 VC”；VC 不足时不下单，只记录拒绝、通知与审计事件。

#### 6.3.5 行为边界

- 名义价值决策权在 Signal Trader，signal provider 不能直接注入仓位强度自由度。
- 执行可合仓，但分账必须按 `subscription_id` 可逆反拆。
- 持仓中不允许系统主动平仓；V1 core 只接受显式 `direction=0` 作为平仓信号。

### 6.4 接口契约（核心库 + ExecutionPort）

```ts
type SignalValue = -1 | 0 | 1;

interface SubmitSignalCommand {
  command_type: 'submit_signal';
  signal_id: string;
  signal_key: string;
  product_id: string;
  signal: SignalValue;
  source: 'model' | 'manual' | 'agent';
  entry_price?: number; // required when any resulting intent increases risk
  stop_loss_price?: number; // required when any resulting intent increases risk
  upstream_emitted_at?: number; // metadata only
  metadata?: Record<string, unknown>;
}

interface UpsertSubscriptionCommand {
  command_type: 'upsert_subscription';
  subscription_id: string;
  investor_id: string;
  signal_key: string;
  product_id: string;
  vc_budget: number;
  daily_burn_amount: number;
  profit_target_value?: number;
  signing_public_key?: string;
  reserve_account_ref?: string;
  status: 'active' | 'paused' | 'closed';
  effective_at: number;
}

interface ApplyExecutionReportCommand {
  command_type: 'apply_execution_report';
  order_id: string;
  report_id: string;
  product_id: string;
  status:
    | 'accepted'
    | 'partially_filled'
    | 'filled'
    | 'cancelled'
    | 'rejected'
    | 'stop_triggered';
  filled_qty?: number;
  avg_fill_price?: number;
  fee?: number;
  reported_at: number;
  raw_report?: Record<string, unknown>;
}

interface CaptureAuthorizedAccountSnapshotCommand {
  command_type: 'capture_authorized_account_snapshot';
  snapshot_id: string;
  account_id: string;
  balance: number; // V1 reconciliation compares projected_balance vs observed balance only
  equity?: number;
  captured_at: number;
  metadata?: Record<string, unknown>;
}

interface DomainEventBase {
  event_id: string;
  event_type: string;
  schema_version: number;
  reducer_version: number;
  idempotency_key: string;
  correlation_id?: string;
  causation_id?: string;
  created_at: number; // stamped by state.clock_ms
  payload: Record<string, unknown>;
}

interface DispatchResult {
  appended_events: DomainEventBase[];
  next_snapshot: LiveTradingSnapshot;
  planned_effects: PlannedEffect[];
}

type ExecutionPort<C = unknown> = Pick<
  IExchange<C>,
  | 'getPositions'
  | 'getOrders'
  | 'getPositionsByProductId'
  | 'getOrdersByProductId'
  | 'submitOrder'
  | 'modifyOrder'
  | 'cancelOrder'
>;

interface ApplyExecutionScope<C = unknown> {
  authorize_order(ctx: {
    credential: C;
    effect: PlaceOrderEffectPayload | ModifyOrderEffectPayload | CancelOrderEffectPayload;
  }): { account_id: string } | Promise<{ account_id: string }>;
}

// frozen V1 API
// createEventSourcedTradingState(seed?)
// dispatchCommand(state, command): DispatchResult
// appendEvents(state, events): LiveTradingSnapshot
// replayEvents(events, options?): LiveTradingSnapshot
// queryProjection(state, query)
// queryEventStream(state, query)
// applyExecutionEffects(port, credential, planned_effects, scope)
// createMockExecutionPort({ get_credential_key, seed? })
```

#### 6.4.1 契约说明

- `dispatchCommand` 的职责不再是“直接产出真相状态”，而是“追加事件并返回最新 snapshot”。
- `planned_effects` 必须可完全由 `appended_events + next_snapshot` 推导；不得携带无法追溯到事件的隐藏语义。
- raw signal 的可信时间戳以 core 的 `state.clock_ms` 为准；上游时间只作 metadata。
- `UpsertSubscriptionCommand` 取代隐式 seed-only profile 模式，使订阅关系本身也进入 append-only 审计链。
- `ApplyExecutionReportCommand` 不直接改仓位真相；其作用是追加 `OrderAccepted / OrderFilled / OrderRejected / stop_triggered ...` 等执行层事件，再由 reducer 落到账本 projection。
- `CaptureAuthorizedAccountSnapshotCommand` 是对账的唯一权威输入；对账结果也必须表现为事件。
- `submit_signal` 若会导致新增风险暴露，则 `entry_price` 与 `stop_loss_price` 必须在命令阶段齐备；V1 不允许在 effect 边界回填关键风控价格。
- `OrderSubmitted` payload 必须冻结净额执行时的归因快照：`order_id`、`product_id`、`target_net_qty`、`current_net_qty`、`external_order_delta`、`attribution: Array<{ subscription_id; target_qty; allocation_rank }>`；后续成交反拆只能基于该快照，不得回读“当前最新 projection”倒推历史。
- `ExecutionPort` 直接复用 `@yuants/exchange` 的 `IExchange` 操作面，通过 `Pick<IExchange, ...>` 收窄到 V1 执行所需子集，避免再维护一套平行协议。
- `applyExecutionEffects` 必须通过宿主提供的 `authorize_order` 回调覆盖 `place / modify / cancel` 全部订单变更 effect；未授权则 fail-close。
- `createMockExecutionPort` 只允许宿主提供非敏感 `get_credential_key`；mock 仅按 opaque key 分桶，不持久化 credential 原文。

### 6.5 Data model / schema（字段与兼容）

#### 6.5.1 Canonical event schema

- `DomainEvent`
  - `event_id`
  - `event_type`
  - `schema_version`
  - `reducer_version`
  - `idempotency_key`
  - `correlation_id`
  - `causation_id`
  - `created_at`
  - `payload`
- 说明：
  - append-only；
  - 新增字段只增不删；
  - 事件是事实本体，snapshot 只是缓存或读模型。

#### 6.5.2 Projection schemas

- `SubscriptionState`（projection）
  - `subscription_id`, `investor_id`, `signal_key`, `product_id`, `status`
  - `target_position_qty`, `settled_position_qty`
  - `vc_budget`, `available_vc`
  - `daily_burn_amount`, `last_budget_eval_at`
  - `profit_target_value`
  - `last_signal_id`, `last_intent_id`
  - `last_effective_stop_loss_price`
  - `funding_account`, `trading_account`
- `InvestorBufferAccount`（projection）
  - `investor_id`, `buffer_amount`, `precision_locked_amount`, `updated_at`
  - `sources: Array<{ source_subscription_id, amount, event_id }>`
- `ProductExecutionProjection`
  - `product_id`, `current_net_qty`, `target_net_qty`, `pending_order_qty`
  - `attribution_map: Record<subscription_id, number>`
- `InvestorProjection`
  - `investor_id`, `subscription_ids`, `total_equity_projection`, `total_buffer_amount`
- `SignalProjection`
  - `signal_key`, `product_id`, `active_subscription_ids`, `last_signal_id`, `last_signal_at`
- `AuditProjection`
  - `signal_id?`, `subscription_id?`, `order_id?`, `event_ids[]`, `latest_status`
- `ReconciliationProjection`
  - `latest_snapshot_id`, `account_id`, `projected_balance`, `observed_balance`, `status`
- V1 对外查询最小要求仅覆盖：`SubscriptionState`、`ProductExecutionProjection`、`AuditProjection`、`ReconciliationProjection`。

#### 6.5.3 最小事件清单（V1）

- `SignalReceived`
- `IntentCreated`
- `IntentRejected`
- `IntentReleased`
- `OrderSubmitted`
- `OrderRejected`
- `OrderAccepted`
- `OrderFilled`
- `ExecutionTimeoutObserved`
- `InternalNettingSettled`
- `MidPriceCaptured`
- `SubscriptionUpdated`
- `AuthorizedAccountSnapshotCaptured`
- `ReconciliationMatched`
- `ReconciliationMismatchDetected`
- `SignalForcedFlatHandled`
- `AlertTriggered`

#### 6.5.4 兼容策略

- 事件 schema append-only。
- reducer 版本升级必须可并存；旧事件允许由新 reducer 重放。
- snapshot 可以丢弃后重建，事件流不能丢。
- 未知事件类型在旧读取端可被跳过，但写入端必须固定 `schema_version` 与 `reducer_version`。

### 6.6 Error semantics（可恢复性 / 重试）

#### 6.6.1 不可恢复错误

- 非法 signal 值。
- `product_id` / `signal_key` 注册态冲突。
- 需要新增风险暴露但缺失或非法 `entry_price / stop_loss_price`。
- 同方向持仓中试图原地修改止损。
- 对未知 `subscription_id` 的订阅变更。

上述错误的表达方式：

- 不是直接抛异常结束；
- 而是追加 `IntentRejected` 等拒绝事件；
- 同时返回当前 snapshot 与拒绝类 effect / alert。

#### 6.6.2 可恢复错误

- 外部执行端口超时。
- 临时拒单。
- 通知通道失败。
- 对账快照暂不可得。
- 宿主执行 effect 时的瞬时网络失败。

可恢复错误的表达方式：

- 追加 `OrderRejected / ExecutionTimeoutObserved / AlertTriggered / IntentReleased` 等事件；
- 允许宿主按幂等键重试 effect；
- 不允许因为 effect 重试而绕过事件闭环直接改状态。

#### 6.6.3 幂等语义

- `signal_id` 是 signal 输入幂等键。
- `report_id` 是 execution report 幂等键。
- `snapshot_id` 是对账快照幂等键。
- 同键同 payload：返回既有结果，不产生新的业务事件。
- 同键不同 payload：追加冲突事件并拒绝后续推进。

#### 6.6.4 账本语义

- 仓位与分账只由 `OrderFilled / InternalNettingSettled` 等事实事件推动；账本与 buffer 变化属于 reducer 投影，不再作为额外 append 事件。
- `OrderRejected` 不能直接改变持仓，只能释放 intent 占用与触发告警。
- `direction=0` 即便当前无仓位，也必须追加 `SignalForcedFlatHandled`。
- 对账 mismatch 不允许静默覆盖 projection；必须追加 `ReconciliationMismatchDetected` 并让 projection fail-close 到 `audit_only`。

---

## 7. Alternatives Considered（>= 2）

### Option A: 单体直接下单（无显式 effects）

- **Pros**: 代码路径短、初期实现快。
- **Cons**: 状态与副作用耦合，失败路径难重放，分账与净额执行难解释。
- **Why not**: 不满足 High-risk 场景的可审计、可追责要求。

### Option B: state-first 厚状态机 + effects 外置

- **Pros**: 比单体直接下单更容易测试，副作用边界相对清晰。
- **Cons**: 随着多订阅、内冲抵、失败补偿、buffer、对账引入，`next_state` 会越来越厚，最终仍然难以回答“为什么会变成这样”。
- **Why not**: 不能把事件作为一等公民，长期会让审计与回放劣化。

### Option C: 事件溯源 + projection / reducer（Chosen）

- **Pros**:
  - 审计日志就是事实；
  - 状态可重放、可比较、可追责；
  - 拒单与补偿语义天然清晰；
  - 适合多投资者分账、净额执行与对账闭环。
- **Cons**:
  - 初期 schema 设计成本更高；
  - reducer 与版本管理需要更严格 discipline；
  - 团队需要接受“effects 不是事实”的工程心智。
- **Why chosen**: 同时满足会议拍板的“审计必备 + 可回放 + 分账精度优先”，并对齐最新设计原则。

### Decision

- 选择：**Option C**。
- 放弃了什么：
  - 放弃 Option A 的实现速度与低认知负担。
  - 放弃 Option B 的短期直觉性状态推进方式。
- 换来了什么：
  - 事件可追溯；
  - 多订阅分账可验证；
  - 失败与补偿语义可证明；
  - 宿主接入更容易围绕事件做审计与回放。

---

## 8. Migration / Rollout / Rollback（强制）

### 8.1 Migration Plan

- 是否有数据迁移：否（本次仍以 core lib + mock 为主）。
- 迁移重点从“状态对象兼容”改为“事件 schema 与 reducer 兼容”。
- 步骤：
  1. 冻结 `DomainEvent` schema、幂等键、版本策略。
  2. 完成 reducer 与 replay。
  3. 将 execution effect planner 挂到 projection 之上。
  4. 最后接 mock / paper / live 宿主。
- Backfill / 双写策略：
  - 当前无双写；
  - 后续若接入生产存储，再单开迁移 RFC；
  - snapshot 可随时重建，不作为迁移真相源。

### 8.2 Rollout Plan

- Feature flags（宿主持有）：
  - `signal_trader.enabled`
  - `signal_trader.execution_mode = audit_only | paper | live`
  - `signal_trader.event_store_mode = append_only`
  - `signal_trader.reducer_version`
  - `signal_trader.internal_netting = enabled`
  - `signal_trader.native_stop_order = required`
- 灰度：
  - `audit_only(replay only) -> paper(events + mock venue) -> live(white list)`
- 验收指标：
  - `event_append_success_rate`
  - `replay_determinism_pass_rate`
  - `subscription_ledger_precision_error`
  - `buffer_account_unexplained_delta_count`
  - `reconciliation_mismatch_count`
  - `direction_zero_audit_success_rate`
  - `stop_order_attach_success_rate`
  - `vc_insufficient_reject_rate`

### 8.3 Rollback Plan（可执行）

- 触发器（任一满足即回滚）：
  - `replay_determinism_pass_rate < 100%`
  - `subscription_ledger_precision_error > 0`
  - `buffer_account_unexplained_delta_count > 0`
  - `reconciliation_mismatch_count > 0`
  - `stop_order_attach_success_rate < 99.9%`
  - 出现无法归因到事件流的状态变更
  - 出现 `unbounded_vc_usage`
- 回滚步骤：
  1. 切 `execution_mode` 到 `audit_only`。
  2. 停止产生新的外部订单 effect。
  3. 保留事件追加、告警与快照捕获。
  4. 从最新稳定 reducer 版本重放事件，重建 projection 并生成 incident 报告。

---

## 9. Observability（强制）

### 9.1 Logs

- 宿主负责落日志；core lib 仅输出结构化 `events / effects / projections` 供宿主消费。
- 关键字段：
  - `trace_id`
  - `signal_id`
  - `subscription_id`
  - `investor_id`
  - `product_id`
  - `event_type`
  - `schema_version`
  - `reducer_version`
  - `error_code`
  - `daily_burn_amount`
  - `profit_target_value`
- 采样策略：
  - 成功低采样；
  - 拒绝 / 失败 / mismatch / timeout / policy rejection 100% 全量。

### 9.2 Metrics

- `signal_accept_rate`
- `signal_reject_rate`
- `intent_created_rate`
- `intent_released_rate`
- `event_append_success_rate`
- `order_effect_emit_rate`
- `order_effect_fail_rate`
- `replay_determinism_pass_rate`
- `subscription_ledger_precision_error`
- `buffer_account_unexplained_delta_count`
- `reconciliation_mismatch_count`
- `direction_zero_audit_success_rate`
- `stop_order_attach_success_rate`
- `vc_insufficient_reject_count`
- `abnormal_reject_spike_count`

### 9.3 Alerts

- 审计缺口；
- 账实不符；
- 硬止损挂单失败率超阈值；
- 幂等冲突突增；
- VC 异常使用；
- 大量短期拒单；
- 出现无法重放一致的 projection。

### 9.4 Debug playbook

- 从 `signal_id` 追踪：
  - `SignalReceived -> Intent* -> Order* -> Ledger* -> Reconciliation*`
- 从 `subscription_id` 追踪：
  - `SubscriptionUpdated -> Intent* -> PositionUpdated -> BufferAdjusted`
- 从 `order_id` 追踪：
  - `OrderSubmitted -> OrderAccepted / OrderRejected / OrderFilled`
- 从 `snapshot_id` 追踪：
  - `AuthorizedAccountSnapshotCaptured -> ReconciliationMatched / Mismatch`

---

## 10. Security & Privacy（强制）

### 10.1 Threat model

- 伪造 / 重放 signal。
- 越权修改风控策略。
- 恶意 burst 导致资源耗尽。
- 伪造执行回报或对账快照。
- 利用跨投资者分账误差转移成本。

### 10.2 权限边界

- 信号提交与策略更新分权。
- 风险策略更新必须要求审批上下文或等价授权材料。
- 投资者级配置 / 资金调度操作应要求签名或等价授权材料，并保留可验签审计证据以避免抵赖。
- 订单 effect 必须通过宿主提供的 `authorize_order` 授权回调。

### 10.3 输入校验

- 强校验 `signal` 枚举、时间戳窗口、`stop_loss_price` 合法性、`VC` 数值边界。
- 强校验 `subscription_id / signal_key / product_id` 注册态一致性。
- 未知 `report_id / snapshot_id / order_id` 回报一律拒收并审计。

### 10.4 资源耗尽防护

- 每 investor / product / subscription 可配置限流。
- 队列超限或拒单异常突增时降级 `audit_only`。
- 不在 core lib 中引入交易语义层的冷却时间；冷却仅可作为宿主资源保护策略，不得改变 canonical 事件语义。

### 10.5 Secrets 与数据保留

- 不记录敏感密钥明文。
- 审计事件仅保留 `signature_ref` / key reference，不存明文凭证。
- 审计保留周期与导出格式由合规流程冻结。

---

## 11. Testing Strategy（强制）

### 11.1 Unit tests

- `TargetPosition_sub` 与 `floor_to_lot` 边界。
- open / add intent 的 `stop_loss_price` 校验。
- 同方向持仓中修改止损的拒绝路径。
- `direction=0` 的强语义与空仓成功事件。
- `buffer_account` 的残差归属与来源链。
- `OrderRejected -> IntentReleased` 补偿链。
- `profit_target_value` 仅触发 alert，不触发 core 自动平仓。
- VC 不足拒绝与通知 / audit effect 输出。

### 11.2 Integration tests（mock ports）

- 单个 signal fan-out 到多个 `subscription_id`。
- 同投资者同 signal 多订阅并存时仍能独立分账。
- product 级净额执行与 subscription 级反拆一致。
- `OrderSubmitted` attribution 快照可支持后续成交确定性反拆。
- 完全内冲抵路径的 `MidPriceCaptured + InternalNettingSettled`（若本轮启用该 milestone）。
- 部分成交、手续费、舍入余数进入 `buffer_account`（可在 core 主路径稳定后补强）。
- 幂等重放与冲突事件路径。
- 授权账户快照导致的 reconciliation matched / mismatch 路径。
- `apply_execution_report` 乱序 / 重复回写的幂等处理。
- 新增风险暴露但缺失 `entry_price / stop_loss_price` 导致的 `IntentRejected`。
- 不允许“预支未来 VC”的回归测试。

### 11.3 Replay consistency tests

- 同一事件流 + 同一 reducer 版本 => projection 完全一致。
- snapshot 丢弃后全量重放 => projection 不变。
- reducer 升级后旧事件兼容重放。
- 拒单、部分成交、完全冲抵、撤资残差都能稳定重放。

### 11.4 Regression tests

- 不允许无事件的“幽灵状态变化”。
- 不允许跨投资者吞并残差。
- 不允许失败执行直接改持仓。
- 不允许未知回报推进状态。
- 不允许持仓中原地修改止损。
- 不允许 `direction=0` 在空仓时被默默吞掉。

### 11.5 Manual validation

- 从单个 `signal_id` 追到 `SignalReceived -> IntentCreated -> Execution* -> Ledger*`。
- 从单个 `subscription_id` 核对 buffer 来源、成交归因与 VC 演进。
- 从单个 `snapshot_id` 验证对账结果可解释、可复现。
- 以 RFC 为源直接生成测试用例；历史实验 case 只作参考样本，不反向覆盖 RFC 契约。

---

## 12. Milestones（可验收最小增量，强制）

### Milestone 1: 事件 schema 冻结

- Scope:
  - 定稿 `DomainEvent` 字段、幂等键、版本号、最小事件清单。
- Acceptance:
  - 能覆盖 `Signal / Intent / Execution / Ledger / Reconciliation` 主路径。
- Rollback impact:
  - 文档级回滚，无运行影响。

### Milestone 2: reducer + replay

- Scope:
  - 实现 `appendEvents / replayEvents / queryProjection / queryEventStream`。
- Acceptance:
  - replay determinism = 100%。
- Rollback impact:
  - 可回退到前一 reducer 版本，不改变事件流真相。

### Milestone 3: ExecutionPort + mock venue

- Scope:
  - 以 `@yuants/exchange` API 语义为蓝本定义 `ExecutionPort`，并完成 mock 验证。
- Acceptance:
  - 通过净额执行、拒单补偿、硬止损、VC 拒绝与对账闭环等关键链路测试；内冲抵与 buffer 细化可作为增强里程碑。
- Rollback impact:
  - 回滚端口接口版本，不破坏事件模型。

### Milestone 4: 宿主接入手册

- Scope:
  - 文档化 `audit_only -> paper -> live` 的事件驱动接入方式、回滚动作、对账职责与授权职责。
- Acceptance:
  - 集成方可只依赖事件与 projection 接入，不绕过 core lib 直接改状态。
- Rollback impact:
  - 文档级回滚。

---

## 13. Follow-ups（非阻塞）

- [ ] 审计日志保留周期与导出合规格式由谁审批并何时冻结？
- [ ] V1 是否需要把 `funding_account / trading_account` 进一步纯化为内部 projection 字段，而不再暴露为对外查询主语？
- [ ] 首版若暂不启用 `InternalNettingSettled`，后续 milestone 如何冻结 `mid` 价格证据格式？

---

## 14. Implementation Notes（落地提示）

- 当前实现已进入 `continue`；交付范围包含 core lib、ExecutionPort / mock、测试与报告。
- 交易所交互边界采用 `ExecutionPort`，操作面直接复用 `@yuants/exchange` 的 `IExchange` 子集。
- 宿主可以把该 core lib 包装成对外可调用的 service，但该 service adapter 不属于本库 frozen API。
- 宿主需要通过 `UpsertSubscriptionCommand` 或等价 seed 预置 `subscription`；`submit_signal` 不再为每个投资者重复携带画像信息。
- 若 signal 会导致新增风险暴露，宿主必须在 `submit_signal` 时一并提供 `entry_price` 与 `stop_loss_price`。
- 宿主负责把 execution report、authorized account snapshot 以 append-only 方式回写到 core lib，不能绕过闭环直接改 projection。
- `planned_effects` 只用于 effect 执行，不应作为回放真相；任何真正发生的事情最终都要回写成事件。
- V1 首批验收聚焦：
  - `submit_signal -> Intent / Execution / Reconciliation` 闭环；
  - 多投资者分账精度；
  - 可重放一致性；
  - 失败补偿路径可解释。
- 测试用例应优先从本 RFC 直接生成；历史实验 case 只作为补充样本，不应反向覆盖 RFC 契约。
- 推荐代码入口：
  - `libraries/signal-trader/src/engine/create-event-sourced-trading-state.ts`
  - `libraries/signal-trader/src/engine/dispatch-command.ts`
  - `libraries/signal-trader/src/engine/append-events.ts`
  - `libraries/signal-trader/src/engine/replay-events.ts`
  - `libraries/signal-trader/src/engine/query-projection.ts`
  - `libraries/signal-trader/src/engine/query-event-stream.ts`
  - `libraries/signal-trader/src/domain/compute-target-position.ts`
  - `libraries/signal-trader/src/domain/reducers/*`
  - `libraries/signal-trader/src/ports/execution-port.ts`
  - `libraries/signal-trader/src/ports/mock-execution-port.ts`
  - `libraries/signal-trader/src/index.ts`

---

## 15. References（证据索引）

- Task brief: `.legion/tasks/signal-trader/docs/task-brief.md`
- Research: `.legion/tasks/signal-trader/docs/research.md`
- Inputs:
  - `whiteboard_exported_image.png`
  - `meetgraph_7612215548813921240_d41f0630-20a3-44d3-8dfb-79f0a030e21b.png`
  - `文字记录：实盘系统与交易策略会议 2026年3月1日.pdf`
  - `智能纪要：量化交易会议确定多项决策 2026年3月11日.pdf`
  - `文字记录：量化交易会议确定多项决策 2026年3月11日.pdf`
- Design principle:
  - `Signal Trader 访谈纪要与事件溯源设计草案 (2026-03-12)`
