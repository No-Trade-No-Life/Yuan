# task-local RFC：signal-trader funding transfer 落地

## 背景 / 问题

根 RFC 已明确 `funding_account` 与 `trading_account` 只是逻辑账户语义：前者表示尚未投入交易风险暴露的预算，后者表示已用于当前交易风险暴露的预算；真实 transfer 只能由宿主执行，不能把 transfer ack 写回 core 真相。但当前 `signal-trader` 仍停留在“预算 projection”阶段：

- `libraries/signal-trader` 只维护预算、仓位与 reconciliation projection，没有真实资金账户与交易账户之间的转账编排。
- `apps/signal-trader` 已有成熟的 live/paper runtime、`submitOrder` 风格的执行适配与 observer 循环，但没有类似的 transfer 接口。
- 仓库已经存在可复用的 transfer 基础设施：`ITransferOrder`、`transfer_order` 表、`@yuants/transfer` 的 `transferApply` / `transferEval`、`apps/transfer-controller`；signal-trader 尚未接入。
- `daily_burn_amount` 与风险预算只会改变逻辑视图，不会在 live 模式下真正推动 `funding_account -> trading_account` 的补资，或在风险下降后归集 `trading_account -> funding_account`。

结果是：paper/live 的“预算足够”与“真实交易账户可下单”之间存在断层。live 可能在逻辑上允许开仓，但交易账户现金不足；observer 也没有在风险收缩后把闲置资金回收到 funding 账户，导致 RFC 与真实运行语义继续漂移。

## 动机

本次目标不是发明新的 transfer 协议，而是在既有 runtime 与 transfer 基础设施之上补齐最小可运行闭环：

- live 在下单前能按 runtime 配置自动补资到交易账户。
- live 在 observer 周期内能在空闲时把多余交易账户余额回收至 funding 账户。
- paper 有等价 mock transfer 语义，能稳定覆盖测试与 walkthrough。
- core 仍只负责 logical funding/trading projection，保持“事件是真相、transfer 是宿主副作用”的边界。

## 目标与非目标

### 目标

- 复用 `ITransferOrder` / `transfer_order` / `apps/transfer-controller`，不新增 transfer schema。
- 在 `SignalTraderRuntimeConfig.metadata` 中定义 runtime 级 transfer 配置模型，未配置时保持完全兼容。
- 在 `apps/signal-trader` 提供类似 `submitOrder` 的可配置 transfer 接口，收口 live submit/poll 与 paper mock。
- 在 core 提供 `funding_account` / `trading_account` projection，供 runtime 做转账决策与调试。
- live 覆盖两条主链：`pre-order transfer-in`、`observer transfer-out`。
- paper 提供 mock transfer，保持与 live 同一触发条件与失败语义。
- 明确幂等、失败收口、回滚与测试映射，确保该能力能被工程实现与审查。

### 非目标

- 不修改 `apps/transfer-controller/**` 或 `libraries/transfer/**` 的协议行为。
- 不新增 signal-trader 专用 transfer 表、transfer event、transfer domain command。
- 不把 transfer 完成回执写回 `libraries/signal-trader` 的 domain event 作为资金真相。
- 不在本轮实现多 funding 账户、跨币种净额调度、自动路由优化或复杂审批流。
- 不要求 core 对真实 funding 账户做第二套 reconciliation；本轮 live 决策主要基于 trading 账户观测与 transfer terminal status。

## 定义

- `funding_account`：逻辑资金账户，表示已释放但尚未占用为交易风险的预算；对 runtime 来说，真实账户 ID 来自 `metadata.signal_trader_transfer.funding_account_id`。
- `trading_account`：逻辑交易账户，表示当前已用于 target risk 的预算；真实账户 ID 继续使用 `runtime.account_id`。
- `pre-order transfer-in`：在 live 下单前，若 trading 账户可用资金低于当前 target risk 所需余额，则先触发 `funding_account -> trading_account`。
- `observer transfer-out`：在 observer 周期内，若无 in-flight order 且 trading 账户可用资金显著高于当前 target risk 所需余额，则触发 `trading_account -> funding_account`。
- `logical funding balance`：core projection 中的 `funding_account`，代表预算口径上的可留在 funding 侧的金额，不等于真实外部账户余额。
- `logical trading balance`：core projection 中的 `trading_account`，代表当前 target risk 需要留在 trading 侧的金额。

## transfer 配置模型

runtime 级 transfer 配置统一放在 `SignalTraderRuntimeConfig.metadata.signal_trader_transfer`，建议模型如下：

```ts
interface SignalTraderTransferConfig {
  funding_account_id: string;
  currency: string;
  min_transfer_amount?: number;
  trading_buffer_amount?: number;
  transfer_timeout_ms?: number;
  transfer_poll_interval_ms?: number;
}
```

约束与默认值：

- `funding_account_id`：必填；为空则视为未启用 transfer。
- `currency`：必填；必须与 live observer 返回的 `account_snapshot.money.currency` 一致，否则 fail-close。
- `min_transfer_amount`：可选，默认 `0`；小于等于该值的差额不发起 transfer，用于抑制抖动。
- `trading_buffer_amount`：可选，默认 `0`；这是 app 决策层的保留缓冲金，不进入 core projection 真相。
- `transfer_timeout_ms`：可选，默认 `max(runtime.poll_interval_ms * 10, 30_000)`；超过该时长仍未终态则视为超时失败。
- `transfer_poll_interval_ms`：可选，默认 `runtime.poll_interval_ms`；用于 pre-order 等待与 observer 轮询中的 poll 间隔。

兼容策略：

- `metadata.signal_trader_transfer` 缺失时，transfer 能力完全关闭，`submitOrder` 主链保持现状。
- paper/live 均读取同一配置结构，但 paper 只走 mock 实现。
- 配置模型只增不删；旧 runtime 不需要迁移数据库。

## core projection 设计

### 总体原则

- core 继续维护事件溯源与预算/仓位真相，不直接感知 `transfer_order`。
- core 对 transfer 的唯一职责，是暴露足够稳定的 logical funding/trading projection，供 app 决策“是否该转、该转多少”。
- projection 必须可由现有 snapshot 纯函数推导，不引入新的 domain event。

### 建议最小新增 projection

不新增新的 query type，避免扩大 core surface；直接把最小 capital 字段挂到现有 `SubscriptionState`：

```ts
interface SubscriptionState {
  ...
  released_vc_total: number;
  available_vc: number;
  funding_account: number;
  trading_account: number;
}
```

语义收口：

- `funding_account = available_vc`；表示预算意义上仍应停留在 funding 侧的金额。
- `trading_account = reserved_vc`；表示当前 target risk 至少需要沉淀在 trading 侧的金额。
- `trading_buffer_amount`、`projected_total_required_balance`、diagnostics 等全部留在 app helper 现算，不进入 core/query 语义。
- projection 只表达“此刻理论上应如何分配预算”，不表达“真实 transfer 是否完成”。

为什么不把 transfer ack 写回 core：

- transfer 是宿主侧副作用，不是信号交易账本的 canonical fact。
- 若把 ack 写回 core，会把 `transfer_order` 状态机与 signal-trader 事件模型耦合，放大 schema 与 replay 复杂度。
- 真实资金是否到账，live 应继续依赖 observer 账户快照与 transfer terminal status，而不是把 transfer controller 当作新的 domain truth。

## app 执行链设计

### app transfer port

在 `apps/signal-trader/src/types.ts` 中新增类似 `LiveExecutionVenue` 的可配置接口，建议如下：

```ts
interface SignalTraderTransferRequest {
  runtime: SignalTraderRuntimeConfig;
  transfer_type: 'pre_order_in' | 'observer_transfer_out';
  from_account_id: string;
  to_account_id: string;
  currency: string;
  expected_amount: number;
  reason: string;
}

interface SignalTraderTransferStatus {
  order_id: string;
  status: 'ONGOING' | 'COMPLETE' | 'ERROR';
  error_message?: string;
  received_amount?: number;
}

interface SignalTraderTransferVenue {
  queryTradingBalance(input: { runtime: SignalTraderRuntimeConfig }): Promise<number>;
  findActiveTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    from_account_id: string;
    to_account_id: string;
    currency: string;
  }): Promise<SignalTraderTransferStatus | undefined>;
  submitTransfer(input: SignalTraderTransferRequest): Promise<SignalTraderTransferStatus>;
  pollTransfer(input: {
    runtime: SignalTraderRuntimeConfig;
    order_id: string;
    transfer_type: SignalTraderTransferRequest['transfer_type'];
  }): Promise<SignalTraderTransferStatus>;
}
```

接口要求：

- `queryTradingBalance` 负责在 pre-order 阶段获取最新 trading 账户可用余额，不依赖旧 observer snapshot。
- `findActiveTransfer` 负责跨重启复用既有未终态单据；runtime 不直接写 SQL。
- `submitTransfer` 负责新建单据。
- `pollTransfer` 负责轮询 terminal status，隐藏 live 的 `transfer_order` 查询细节与 paper 的 mock 状态机。
- `createSignalTraderApp` 与 `createDefaultExecutionAdapterFactory` 需要像注入 `liveVenue.submitOrder` 一样注入 transfer venue。

### pre-order transfer-in

触发时机：`RuntimeWorker.submitSignal()` 中，`appendCommand` 得到最新 planned effects 后、真正 `executionAdapter.execute()` 之前。

执行顺序：

1. 读取当前 runtime transfer config；未配置则跳过。
2. 若 `execution_mode !== 'live'`，走 paper mock 或直接跳至 paper 逻辑。
3. 仅当 planned effects 中存在 `place_order`，才计算本次是否需要 transfer-in。
4. 从当前 state 的 subscription projection 读取 `trading_account`。
5. 基于最新 trading 余额观测，计算：

```text
desired_trading_free = trading_account + trading_buffer_amount
transfer_gap = desired_trading_free - observed_trading_free
```

6. pre-order 不再依赖“最近一次 observer snapshot”，而是直接调用 `transferVenue.queryTradingBalance()` 获取最新 trading 可用余额。
7. 当 `transfer_gap > min_transfer_amount` 时，先查 `findActiveTransfer(from=funding,to=trading,currency)`：
   - 若存在未终态旧单：直接 `pollTransfer` 到终态，再重新计算缺口
   - 若不存在：`submitTransfer(pre_order_in)` 然后 `pollTransfer`
8. 只有在缺口被补齐或本次无需补资时，才进入 `executionAdapter.execute()`。
9. 若返回 `ERROR`、超时、金额/币种不一致，runtime 进入 `audit_only`，reason 统一收口为 transfer 失败类错误。

设计约束：

- pre-order transfer-in 只保证“下单前至少尝试把 trading 账户补到目标余额”；不保证实时精确对齐每笔 fill 后的瞬时余额。
- pre-order 通过“单 runtime 单方向最多一个 active transfer + 完成后重算缺口”保证幂等，而不是把同一 `signal_id` 强绑定到固定金额。
- transfer 成功后不向 core 追加新事件；真正的资金到账仍由后续 observer snapshot 体现。

### observer transfer-out

触发时机：`RuntimeWorker.observeOnceInternal()` 在完成账户快照写入、更新 bindings、确认当前无 in-flight order 后执行。

执行条件：

- runtime 已启用 transfer config。
- 当前没有 in-flight order，也没有任一 active transfer。
- `execution_mode === 'live'`。
- 已有 fresh account snapshot，且 snapshot currency 与 transfer config 一致。
- 最近一次 transfer 完成后，必须等待新的 `account_snapshot.updated_at > transfer_completed_at`，否则不再次 sweep。

计算方式：

```text
retain_trading_free = trading_account + trading_buffer_amount
transfer_excess = observed_trading_free - retain_trading_free
```

当 `transfer_excess > min_transfer_amount` 时，发起 `observer_transfer_out`：

- `from_account_id = runtime.account_id`
- `to_account_id = funding_account_id`
- `expected_amount = transfer_excess`

observer transfer-out 的目标不是把 trading 账户清零，而是把“风险所需 + buffer”之外的闲置资金回收。

为抑制 sweep 抖动，observer transfer-out 采用双观察门槛：

- 第一个 fresh snapshot 只记录 `pending_transfer_out_candidate`
- 只有连续两个 observer 周期都观察到 `transfer_excess > min_transfer_amount`，且两次都无 active order / active transfer，才真正发起 transfer-out

### 执行边界

- transfer venue 与 order venue 平行存在：`submitOrder` 处理订单 effect，transfer venue 处理资金 effect。
- runtime 负责决定何时调用 transfer venue，但不直接持久化 transfer 状态。
- observer 仍是 live 真实状态的最终裁判：即使 transfer controller 回报 `COMPLETE`，也要等 observer 后续看到 trading 余额变化才算账户状态跟上。

## paper / live 适配

### paper

- 提供 `PaperTransferVenue`，使用内存 map 或测试桩记录 active transfer / trading balance。
- 默认行为可直接返回 `COMPLETE`，并由 paper venue 统一驱动 mock trading balance；paper 不额外走一套“直接改余额”的隐藏捷径。
- 如测试需要，可配置为 `ONGOING -> COMPLETE` 或 `ERROR`，覆盖超时、失败与重复请求路径。
- paper 的触发条件、幂等键、金额计算必须与 live 共用同一 runtime helper，避免纸面语义分叉。

### live

- 提供 `LiveTransferVenue`，内部复用 `ITransferOrder` / `transfer_order` / `apps/transfer-controller`。
- `findActiveTransfer` 负责复用同方向未终态单据，避免 runtime 重启后重复打款。
- `submitTransfer` 负责构造 `ITransferOrder`：
  - `credit_account_id = from_account_id`
  - `debit_account_id = to_account_id`
  - `currency = config.currency`
  - `expected_amount = rounded_amount`
- `pollTransfer` 通过 `order_id` 读取 `transfer_order` 终态，或查询同 idempotency key 的既有单据。
- transfer controller 仍负责路由、apply/eval、超时与 ERROR/COMPLETE 状态推进；signal-trader 不复制这套状态机。

## 幂等与失败收口

### 幂等模型

- 单 runtime 同一时刻最多允许一个 active transfer；direction 只是辅助信息，不允许同 runtime 并行多笔 transfer。
- pre-order transfer-in：优先复用 `findActiveTransfer(from=funding,to=trading,currency)` 的未终态单据；旧单终态后重新计算缺口，再决定是否补差额。
- observer transfer-out：优先复用 `findActiveTransfer(from=trading,to=funding,currency)` 的未终态单据；完成后必须等到更新后的 snapshot 才允许新 sweep。
- 不再使用“同 key 不同金额直接 fail-close”的僵硬策略；金额变化通过“等待旧单终态 -> 重新计算缺口”自然收敛。

### 失败语义

- `TRANSFER_CONFIG_INVALID`：metadata 缺字段、币种非法、金额参数非正数；不可恢复，拒绝启动或切 `audit_only`。
- `TRANSFER_PRECONDITION_MISSING_ACCOUNT_SNAPSHOT`：live 需要 transfer-in/out，但当前没有 fresh trading account snapshot；可恢复，等待 observer 后重试，但本次 submit fail-close。
- `TRANSFER_PRECONDITION_MISSING_TRADING_BALANCE`：pre-order 无法通过 venue 获取最新 trading balance；本次 submit fail-close。
- `TRANSFER_TIMEOUT`：transfer 长时间未终态；可人工重放，但 runtime 本次进入 `audit_only`，防止盲目重复转账。
- `TRANSFER_ERROR`：transfer order 进入 `ERROR`；默认人工介入，不自动重试。
- `TRANSFER_CURRENCY_MISMATCH`：observer snapshot currency 与 transfer config 不一致；不可恢复，直接锁定。

### 收口原则

- live 下任何 transfer 异常均优先 fail-close 到 `audit_only`，而不是“跳过转账继续下单”。
- paper 下失败同样要把结果显式暴露给测试；不能静默吞掉 mock transfer 错误。
- transfer 的恢复入口优先复用已有 `unlockRuntime` / `replayRuntime`，不新增特殊控制面。

## Alternatives

### 方案 A：只做 core funding/trading projection，不做真实 transfer

放弃原因：

- 无法满足用户明确要求的“要有真实转账”。
- live 仍会出现逻辑预算允许开仓、但真实 trading 账户余额不足的问题。
- 只能改善文档与 query，不能闭环运行时行为。

### 方案 B：在 signal-trader 内新增 transfer 表和独立 controller

放弃原因：

- 与仓库已有 `transfer_order` / `apps/transfer-controller` 重复造轮子。
- 需要新 schema、新状态机与额外迁移，明显超出本次 scope。
- 会制造两套 transfer 协议，增加后续维护与审计成本。

### 方案 C：复用既有 transfer 基础设施，在 app/runtime 编排 transfer，core 只给 projection（采用）

- 保留了根 RFC 的边界：core 不接 transfer ack 真相。
- 满足 live 真转账与 paper mock 的双路径要求。
- 改动集中在 `libraries/signal-trader` projection 与 `apps/signal-trader` 编排层，风险可控。

## 数据模型 / 接口

### 数据模型

- 不新增 transfer 数据库 schema。
- `SignalTraderRuntimeConfig.metadata.signal_trader_transfer` 是唯一新增配置入口。
- `transfer_order` 继续作为 live transfer 的持久化状态机；signal-trader 只读写既有字段，不扩表。

### 接口边界

- `libraries/signal-trader`：在既有 `SubscriptionState` 上补最小 capital 字段，不新增 transfer command/event。
- `apps/signal-trader/src/types.ts`：新增 `SignalTraderTransferVenue`、`SignalTraderTransferRequest`、`SignalTraderTransferStatus`。
- `apps/signal-trader/src/app.ts`：扩展 app options，允许注入 paper/live transfer venue。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：把 transfer-in/out 编排接到 submit/observe 主链。

### 兼容策略

- 未配置 transfer metadata 的 runtime 完全不受影响。
- 老事件流、老 checkpoint、老 runtime config 均可继续工作。
- 仅扩展既有 `SubscriptionState` 字段，不新增 query type；旧调用方不受影响。

## 错误语义

- transfer 是可恢复副作用，但在 live 交易语义上属于高风险前置条件，因此本轮对 submit 路径采用 fail-close。
- `pre-order transfer-in` 失败：本次 `submitSignal` 返回 rejected，并把 runtime 锁到 `audit_only`。
- `observer transfer-out` 失败：不回滚既有仓位，但 runtime 切 `audit_only`，避免继续自动资金搬运。
- 重试只允许建立在幂等键与既有 transfer order 之上；不允许丢掉旧单据后重新生成一笔“看起来一样”的转账。
- observer 未看到余额变化不等于 transfer 失败，但若 transfer order 已终态且多个观察周期仍无账户侧变化，应记录 audit log 并保持人工排查入口。

## 安全考虑

用户允许本轮弱化安全，但最小边界仍需保留：

- transfer metadata 需要做严格输入校验，防止空 funding account、非法币种、负金额或非有限数。
- live transfer 默认只能在 runtime 已通过现有 capability / observer gate 后执行，不能绕过启动门禁。
- transfer venue 不记录凭证明文；继续复用现有 credential 注入模式。
- 对 observer transfer-out 必须要求“无 in-flight order + fresh snapshot”，防止在仓位尚未稳定时误归集资金。
- 所有 transfer 失败、幂等冲突、金额不一致都要进入 runtime audit log，便于人工追责。
- 通过 `min_transfer_amount` 与单方向 active transfer 限制，抑制高频小额 transfer 导致的资源耗尽与抖动。

## 风险、向后兼容与回滚

### 主要风险

- logical projection 与真实 trading free balance 口径不一致，导致多转或少转。
- observer transfer-out 条件过于激进，刚降风险就把资金扫回，随后又因新信号转入，形成抖动。
- 幂等键设计不稳，重复 submit/observe 导致重复转账。
- live transfer terminal status 与 observer 账户快照在短时间内不同步，造成误判。

### 向后兼容

- 无 schema 迁移，无 event schema 破坏。
- transfer feature 默认关闭；只有配置 metadata 的 runtime 才启用。
- 旧 paper/live 行为保持不变。

### 发布与灰度

1. 先交付 core projection 与 paper mock transfer。
2. 再接 live `ensureTransfer/pollTransfer`，默认仅在测试 runtime 打开。
3. 通过 paper/live 回归后，再对单一白名单 runtime 灰度启用真实 transfer。

### 回滚

- 最快回滚：移除或忽略 `metadata.signal_trader_transfer`，runtime 回到无 transfer 模式。
- 若已上线代码但出现 live 风险，可直接把相关 runtime `disable` 或 `unlock -> upsert` 为无 transfer 配置。
- 因为没有 schema 变更，代码回滚即可恢复；已产生的 `transfer_order` 保留审计，不做物理删除。

## 测试计划

### core

- `SubscriptionState` capital 字段：验证 `funding_account` 与 `trading_account` 能正确反映 `available_vc` / `reserved_vc`。
- daily burn 与 transfer projection 联动：跨天释放后 funding/trading projection 同步更新。
- 未引入 transfer ack 时 replay 仍稳定：同一事件流 + 同一时间得到同一 capital projection。

### app / paper

- `submitSignal` 触发 `pre-order transfer-in`：gap 超过阈值时先走 mock transfer，再进入 paper order execution。
- observer 触发 `transfer-out`：无 in-flight order 且 trading free 超额时产生 mock sweep。
- mock transfer `ERROR` / `TIMEOUT`：paper 测试能观察到明确失败，不会静默继续。

### app / live

- pre-order transfer-in happy path：先 `ensureTransfer/pollTransfer=COMPLETE`，再 `submitOrder`。
- pre-order transfer-in failure：transfer `ERROR` 或超时时，runtime 进入 `audit_only`，订单不提交。
- observer transfer-out happy path：无 active order 时产生真实 transfer order submit/poll。
- observer transfer-out dedupe：同一 snapshot 或存在未完成旧单时，不重复创建 transfer。
- currency mismatch / missing snapshot：直接 fail-close。

### 验收映射

- “paper 要有 mock transfer” -> paper adapter 测试。
- “live 要有真实 submit/poll” -> live transfer venue 测试。
- “pre-order transfer-in + observer transfer-out” -> runtime worker 集成测试。
- “core 只提供 projection，不把 ack 写成真相” -> core replay / query 测试。

## 开放问题

- observer / venue 使用 `money.balance` 还是更细粒度的可用余额字段作为 trading 余额口径，是否需要按不同 venue 做微调？本 RFC 建议先统一为已有 `balance` 口径，后续再做 vendor 细化。
- live transfer venue 是否需要把 active transfer 查询进一步下沉到独立 repository helper，以避免 runtime 未来直接感知 SQL 形态？当前建议下沉到 venue 内部即可。

## 里程碑

### Milestone 1：配置与 projection 收口

- 在 `SignalTraderRuntimeConfig.metadata` 定义 transfer config。
- 在 core 的 `SubscriptionState` 上新增最小 capital 字段与对应测试。

### Milestone 2：paper transfer 闭环

- 实现 `PaperTransferVenue`。
- 在 `submitSignal` 与 observer 链上接入 mock transfer。
- 补齐 paper 成功 / 失败 / 幂等回归。

### Milestone 3：live transfer 闭环

- 实现 `LiveTransferVenue`，复用 `ITransferOrder` / `transfer_order` / `apps/transfer-controller`。
- 落地 pre-order transfer-in submit/poll。
- 落地 observer transfer-out submit/poll 与去重。

### Milestone 4：灰度与文档交付

- 补齐 live 集成测试、test report、review 材料。
- 以单 runtime 白名单方式灰度启用，确认回滚动作清晰。

## Plan

### 文件变更点

- `libraries/signal-trader/src/types/snapshot.ts`：在既有 `SubscriptionState` 上新增最小 capital 字段。
- `libraries/signal-trader/src/engine/query-projection.ts`：沿用既有 subscription query 返回扩展后的 logical funding/trading 字段。
- `apps/signal-trader/src/types.ts`：新增 transfer config typing 与 transfer venue 接口。
- `apps/signal-trader/src/app.ts`：支持注入 transfer venue。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：接入 pre-order transfer-in 与 observer transfer-out 编排。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：补齐 paper/live transfer 回归。

### 验证步骤

1. 运行 `libraries/signal-trader` 单测，确认 capital projection 与 replay 语义稳定。
2. 运行 `apps/signal-trader` 测试，确认 paper mock transfer 与 live transfer submit/poll 回归通过。
3. 人工检查 live happy path：transfer-in 完成后才调用 `submitOrder`；transfer-out 仅在 observer 空闲期触发。
4. 人工检查回滚路径：删除 transfer metadata 后，runtime 恢复既有无 transfer 行为。
