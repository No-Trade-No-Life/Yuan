# task-local RFC：signal-trader daily burn budget 补齐

## 背景 / 问题

根 RFC 已冻结 `daily_burn_amount` 驱动的 lazy-evaluate 预算释放语义，但当前实现仍停留在字段接线阶段：

- `libraries/signal-trader/src/domain/reducer.ts` 仍把 `available_vc` 近似成 `vc_budget - reserved`，`last_budget_eval_at` 只记录不推进。
- `libraries/signal-trader/src/engine/dispatch-command.ts` 的 sizing 直接使用静态 `subscription.vc_budget`，导致跨天新增预算不会进入目标仓位计算。
- `libraries/signal-trader/src/engine/query-projection.ts` 直接返回 snapshot 当前值，query 路径没有补算预算释放。
- `capture_authorized_account_snapshot` 的 projected balance 以当前 `available_vc` 汇总，未与 lazy-evaluate 预算口径对齐。
- app 层 paper/live 虽都带有 `vc_budget` 与 `daily_burn_amount`，但没有共享一套真正生效的 core 预算语义。

结果是 command、query、reconciliation 三条主链对“当前可投 VC”的理解不一致，paper 无法稳定验证 D+1 / D+2 预算释放，live replay 也无法保证与实时行为一致。

## 动机

本次不是重做风控模型，而是把已经定稿的预算释放语义补齐到可执行状态：

- 用户能在 paper/live 中看到相同的按天释放行为。
- replay、query、对账都使用同一预算模型，消除心智漂移。
- 保持当前 schema 与主链不扩张，只在既有 event-sourced projection 上把预算 lazy-evaluate 落地。

## 目标与非目标

### 目标

- 在 core 中定义并复用单一预算求值逻辑，覆盖 command、query、reconciliation。
- 采用 full-day（24h）lazy-evaluate，保证 replay 时只依赖输入时间与事件流。
- paper 与 live 仅负责提供“当前时间”，不在 app 层复制预算公式。
- 新 subscription 首日立即获得 `min(vc_budget, daily_burn_amount)` tranche。
- sizing 基于 `sizing_vc_budget`，使已有持仓在跨天新增释放额度后能反映到下一次信号计算。
- 不新增数据库 schema，不引入 transfer ack 作为真相来源。

### 非目标

- 不新增资金账户表、预算流水表或新的持久化 schema。
- 不实现按时区日历日切换，只采用固定 24h 窗口。
- 不在本轮引入新的 runtime clock provider 协议；测试优先用 fake timers 控时。
- 不扩大安全边界到高强度鉴权/反滥用体系重构。

## 定义

- `released_vc_total`：截至某一 `now_ms`，该 subscription 理论上已释放的总预算，范围 `[0, vc_budget]`。
- `current_reserved_vc`：当前目标仓位占用的风险金额，由 `abs(target_position_qty) * risk_per_unit` 计算；无有效止损/开仓价时视为 `0`。
- `available_vc`：`released_vc_total - current_reserved_vc` 的非负截断值，表示当前已释放且未被现有 target risk 占用的额度。
- `sizing_vc_budget`：下一次 sizing 真正使用的预算，定义为 `max(released_vc_total, current_reserved_vc)`；其含义是“已释放预算”与“当前已存在风险占用”二者取高值，避免在 release 追不上现有风险时对已有 target 发生隐式缩仓。
- `last_budget_eval_at`：预算模型最后一次完成 lazy-evaluate 的时间锚点；每次补算成功后推进到新的求值时间。

## 预算模型与公式

### 核心假设

- 时间窗口固定为 `DAY_MS = 86_400_000`。
- 首次建仓日立即获得首日 tranche：

```text
initial_release = min(vc_budget, daily_burn_amount)
```

- 后续仅按整天释放：

```text
elapsed_days = floor(max(0, now_ms - last_budget_eval_at) / DAY_MS)
budget_release = daily_burn_amount * elapsed_days
released_vc_total' = min(vc_budget, released_vc_total + budget_release)
last_budget_eval_at' = last_budget_eval_at + elapsed_days * DAY_MS
```

- 风险占用与 sizing 预算：

```text
current_reserved_vc = abs(target_position_qty) * abs(entry_price - stop_loss_price) * contract_multiplier
available_vc = max(0, released_vc_total - current_reserved_vc)
sizing_vc_budget = max(released_vc_total, current_reserved_vc)
```

### 设计说明

- 若 `current_reserved_vc <= released_vc_total`，则 `sizing_vc_budget = released_vc_total`；这时跨天新增 release 会直接体现在下一次 sizing 上。
- 若 `current_reserved_vc > released_vc_total`，说明现有 target 风险已经高于当前 release entitlement。此时策略是：
  - 不因 budget helper 自动强制缩仓
  - 不允许把预算继续向更大目标扩张，直到新的 release 追平现有风险
  - query/reconciliation 继续显示 `available_vc = 0`
- 因此 `sizing_vc_budget` 不是“当前空闲预算”，而是“允许维持现状且只在 release 追平后再扩张”的 sizing 下界。
- `daily_burn_amount = 0` 时只保留首日 tranche 规则；若同时为 0，则 subscription 永远没有可释放预算。
- `vc_budget < daily_burn_amount` 时首日直接释放满额，后续不再增长。
- `now_ms <= last_budget_eval_at` 时不释放新预算，也不回退状态，保证 replay 幂等。

## 方案设计

### 总体原则

- 预算公式只在 core library 出现一次。
- app 层只负责为“单次请求 / 单次 worker 执行”采样一次 `now_ms`，然后把同一个时钟值灌入 core；不能在 query/dispatch/reconcile 内部分别重新取 `Date.now()`。
- 所有投影返回值都以“先预算补算，再读字段”的顺序计算。

### Core 设计

在 `libraries/signal-trader/**` 新增一个预算 helper（例如 `src/domain/evaluate-budget.ts`），负责：

- 从 subscription 当前字段推导 `released_vc_total` / `current_reserved_vc` / `available_vc` / `sizing_vc_budget`。
- 在给定 `now_ms` 时生成补算后的 subscription 副本。
- 提供对整个 snapshot 的预算补算入口，供 command/query/reconciliation 共用。

`reducer.ts` 继续维护事件真相与基础字段，但不再把“未来时点预算已补算”逻辑散落在 reducer 分支里；其职责收敛为：

- 为新 subscription 初始化首日 tranche 与 `last_budget_eval_at`。
- 在 target position 改变后仅重算 `current_reserved_vc` 相关视图，不自行假设未来天数。
- 在 `SubscriptionUpdated` 覆盖已有 subscription 时，按 `effective_at` 先把旧 subscription 的 `released_vc_total` lazy-evaluate 到配置生效点，再：
  - 保留已释放总额（clamp 到新的 `vc_budget`）
  - 仅对新建 subscription 发放首日 tranche
  - 不重复给已存在 subscription 再发一次“首日预算”

### Command 链

`dispatchCommand(state, command)` 在进入命令处理前，先以 `state.clock_ms` 对 snapshot 做预算 lazy-evaluate，再用补算后的 subscription 参与：

- 风险暴露校验。
- `computeTargetPosition` 的输入预算。
- preview state 里的 product 汇总与后续 order delta 计算。

Sizing 从 `vc_budget` 切换为 `sizing_vc_budget`，这样：

- 正常情况下跨天新增释放额度会参与下一次 rebalance
- 现有风险已超过 release entitlement 时，不会因为 budget helper 让已有 target 被隐式收缩

### Query 链

`queryProjection(state, query)` 改为先对 snapshot 执行相同 budget evaluation，再返回对应 projection：

- subscription query 返回最新 `available_vc` / `last_budget_eval_at` 口径。
- product query 间接受益于 subscription 已重算后的 target 相关字段。
- reconciliation query 看到的 projected balance 与 command/reconcile 口径一致。

对 query / dispatch / reconciliation 统一采用同一种 budget evaluation 语义：

- 它不是新的 domain event，而是 projection cache refresh
- `available_vc` / `last_budget_eval_at` 属于 projection 字段，本就不是 append-only 真相
- helper 可以直接在内存 snapshot / checkpoint snapshot 上推进这些字段，只要给定同一事件流与同一 `clock_ms` 就能得到同一结果

因此不存在“无事件状态漂移破坏 replay”的问题：漂移被限制在 projection cache 层，而 replay 真相始终是 `events + now_ms`。

### Reconciliation 链

`capture_authorized_account_snapshot` 在比较 `projected_balance` 前，必须先使用同一 budget helper 对 snapshot 求值，然后按最新 `available_vc` 汇总：

```text
projected_balance = sum(subscription.available_vc)
```

这样 paper/live 的对账都以“当前时点已释放且未占用的预算”为账户可用余额口径，不再受是否刚好发生了别的命令影响。

## paper / live 一致性设计

- budget 公式、tranche 规则、对账口径全部放在 `libraries/signal-trader`。
- `apps/signal-trader/src/runtime/runtime-worker.ts` 在 `submitSignal`、observer 触发 reconciliation、worker 内 query 时，必须在请求入口采样一次 `now_ms`，写入 `state.clock_ms`，随后复用到底。
- `apps/signal-trader/src/runtime/runtime-manager.ts` 的脱机 query 也必须在构建 state 时采样一次 `now_ms`，后续同一调用内不再重新读取系统时间。
- paper 与 live 的差异只保留在 effect 执行、外部观察与健康状态管理；不允许在 app 层做“paper 直接补算、live 靠 observer”这种双轨语义。

## 接口 / 数据模型

### 现有字段保留

不新增 schema，继续使用现有 subscription 字段：

- `vc_budget: number`
- `available_vc: number`
- `daily_burn_amount: number`
- `last_budget_eval_at: number`
- `target_position_qty: number`
- `last_entry_price?: number`
- `last_effective_stop_loss_price?: number`
- `contract_multiplier: number`
- `lot_size: number`

### 新增的内部派生语义

- `released_vc_total`、`current_reserved_vc`、`sizing_vc_budget` 优先作为 helper 返回值或内部临时结构，不要求立即进入持久化 snapshot 类型。
- 若测试或 query 需要暴露诊断字段，优先通过内部 helper 断言，不先扩大对外 API。

### 兼容策略

- 旧事件流不变；replay 时只要给定同样事件序列和相同 `clock_ms`，即可得到一致结果。
- 对既有 snapshot 字段保持向后兼容；语义变化仅体现在 `available_vc` 与 `last_budget_eval_at` 会真实推进。

## 错误语义

- `VC_INSUFFICIENT`：在 budget evaluation 后，`sizing_vc_budget` 仍无法支持最小 lot 的目标仓位；可恢复，等待 D+1 预算释放或调整止损后可重试。
- `STOP_LOSS_INVALID_*`、`ENTRY_PRICE_INVALID` 等输入错误：不可通过重试自动恢复，必须修正命令参数。
- `now_ms` 缺失或非有限数：视为调用层错误，应 fail fast；paper/live 必须始终提供确定时钟。
- query 路径不产生命令型错误；若对象不存在，延续当前 `undefined` 返回语义。
- reconciliation mismatch 在本轮仍按现有告警/锁定路径处理，但 mismatch 的 projected balance 必须基于补算后的预算结果。

## 时间控制与测试策略

### 时间控制

- core 单测直接构造不同 `clock_ms` 的 state，覆盖 D0 / D1 / D2 / 非整天边界。
- app 测试优先使用 Jest fake timers / `setSystemTime`，避免新增 runtime clock provider。
- 所有跨天测试都使用固定 `baseTime + n * DAY_MS`，不依赖本地时区日期切换。

### 测试映射

- command：同一 subscription 在 D0 提交信号、D+1 再次提交，第二次 sizing 应使用更高的 `sizing_vc_budget`。
- query：仅推进时间不追加事件时，`queryProjection(subscription)` 也应看到新增 `available_vc` 与推进后的 `last_budget_eval_at`。
- reconciliation：同一事件流下，D0 / D+1 的 `capture_authorized_account_snapshot` projected balance 应不同且可预期。
- replay：同一固定时间重新 replay，结果必须与首次执行一致。
- paper/live：两条路径对同一 runtime config 和相同时间推进，得到相同预算行为。

## Alternatives

### 方案 A：只在 app 层 query / runtime 上补算预算

不选原因：

- command 链仍会使用静态 `vc_budget`，实际下单与 query 观察不一致。
- paper/live 容易形成两套补算位置，破坏 replay 一致性。
- reconciliation 仍要再次复制公式，维护成本高。

### 方案 B：把已释放总预算持久化为新字段或新表

不选原因：

- 超出本次 scope，违反“不新增数据库 schema”的约束。
- 会把可由事件流与时间推导的视图固化成新的真相源，增加回放复杂度。

## 安全考虑

本轮安全强度可弱化，但仍保留最小必要边界：

- 所有预算输入必须做有限数校验，防止 `NaN` / `Infinity` 污染 replay。
- 对 `daily_burn_amount < 0`、`vc_budget <= 0` 继续使用现有 runtime/config 校验拒绝写入。
- budget evaluation 必须使用非负截断与上限钳制，避免时间异常导致资源放大。
- 不把 query 补算结果写回事件流，避免通过高频查询制造事件放大或审计噪音。
- live 对账与 submit 仍沿用既有 health / lock 流程，不因预算补算放宽外部执行门槛。

## 向后兼容、发布与回滚

### 向后兼容

- 事件 schema、runtime config schema、repositories schema 均不变。
- 兼容已有 runtime，只是预算口径从“静态 VC”切换为“按天释放 VC”。

### 发布策略

- 先补齐 library 单测，再补 app 层 paper/live 回归测试。
- 通过 replay 测试确认新旧事件流在固定 `clock_ms` 下可稳定复现。
- 优先在 paper 路径验证跨天行为，再观察 live reconciliation 测试。

### 回滚策略

- 若发现 live sizing 或 reconciliation 口径异常，可整体回滚到“使用静态 `vc_budget`”的实现版本。
- 由于无 schema 变更，代码回滚即可恢复旧行为；不需要数据迁移。
- 回滚后需明确标记 task-local RFC 与实现再次漂移，避免文档假阳性。

## 验证计划

- `libraries/signal-trader`：新增 budget helper 单测，覆盖首日 tranche、D+1 / D+2 补算、已有持仓时的 `sizing_vc_budget`。
- `libraries/signal-trader`：回归 `dispatchCommand`，验证同一信号在不同天数下产生不同 target qty。
- `libraries/signal-trader`：回归 `queryProjection` 与 `capture_authorized_account_snapshot`，验证纯 query / reconcile 也会触发同口径补算。
- `apps/signal-trader`：paper runtime 测试推进系统时间，验证 query 与 submit 一致。
- `apps/signal-trader`：live runtime 测试推进系统时间并触发 observer/reconciliation，验证 projected balance 与健康路径不偏离。
- `apps/signal-trader`：replay 测试在固定时钟下重建 state，确认结果稳定。

## 开放问题

- 本轮是否需要把 `released_vc_total` 作为诊断字段暴露给 query / audit？当前建议先不暴露，避免扩大 API 面。
- 对于长期无命令、无 query、无 observer 的 runtime，预算只会在下一次触发时懒计算；当前接受该行为，因为它与根 RFC 的 lazy-evaluate 约定一致。

## 对账影响

- reconciliation 的 `projected_balance` 将从“历史遗留的当前 available_vc 汇总”收敛为“按当前时间补算后的 available_vc 汇总”。
- 这意味着同一账户在没有任何新成交时，也可能因跨天释放预算而出现 projected balance 增长；该变化是预期行为，不应被误判为 replay 漂移。
- live observer 采集到账户余额时，若外部账户未同步相同的预算释放/资金转拨策略，仍可能出现 mismatch；本轮只要求 core 口径自洽，不在 scope 内解决真实资金调度。

## 风险与回滚

- 主要风险是 `available_vc` / `released_vc_total` / `sizing_vc_budget` 混用，导致 sizing 仍然错吃空闲额度或在 over-reserved 状态下隐式缩仓。
- 第二风险是 query 补算与 dispatch 补算入口不同步，造成“看到能下单但实际拒绝”或反向问题。
- 第三风险是 live runtime 的 query 仍走旧的 checkpoint state，没有注入当前时间，导致 paper/live 表面一致、脱机 query 不一致。
- 回滚策略见上文：仅回滚代码，无需迁移；回滚前需保留失败用例，防止再次引入相同漂移。

## 实施里程碑

### Milestone 1：core 预算 helper 落地

- 在 `libraries/signal-trader` 抽出统一 budget evaluation helper。
- 将 reducer 初始化改为首日 tranche 语义。
- 为 helper 与 reducer 增加 D0 / D1 / D2 单测。

### Milestone 2：三条主链接入同一预算口径

- `dispatchCommand` 改为先补算预算，再用 `sizing_vc_budget` 做 sizing。
- `queryProjection` 改为只读补算后返回 projection。
- `capture_authorized_account_snapshot` 改为基于补算后的 `available_vc` 计算 projected balance。

### Milestone 3：app 层控时与回归

- `runtime-worker` 与 `runtime-manager` 确保 query / submit / reconcile 使用一致当前时间。
- paper/live 测试引入 fake timers，补齐跨天预算释放回归。
- 最终产出 review / test report 等任务文档，确认实现与 RFC 收敛。

## 落地计划

### 文件变更点

- `libraries/signal-trader/src/domain/*`：新增或抽取 budget evaluation helper，收口公式。
- `libraries/signal-trader/src/domain/reducer.ts`：修正 subscription 初始化与 risk 相关重算职责。
- `libraries/signal-trader/src/engine/dispatch-command.ts`：命令前预算补算，sizing 改吃 `sizing_vc_budget`。
- `libraries/signal-trader/src/engine/query-projection.ts`：query 前预算补算。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：worker 内 query / submit / observe 路径统一时钟传递。
- `apps/signal-trader/src/runtime/runtime-manager.ts`：脱机 query 也要走一致时钟语义。
- `libraries/signal-trader/src/index.test.ts`、`apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：新增跨天回归。

### 验证步骤

1. 运行 `libraries/signal-trader` 单测，确认预算 helper 与 command/query/reconcile 回归全部通过。
2. 运行 `apps/signal-trader` 相关测试，确认 paper/live 在 D+1 / D+2 下表现一致。
3. 在固定系统时间下执行 replay 回归，确认没有因 lazy-evaluate 引入非确定性。
4. 人工检查 query 与 reconciliation 返回的 `available_vc` / `last_budget_eval_at` 是否与预期公式一致。
