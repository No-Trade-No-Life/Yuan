# RFC：signal-trader 资本系统补完（任务局部）

## 背景 / 问题

- 当前 `signal-trader` 已完成事件溯源主链、`daily_burn_amount` lazy-evaluate，以及 funding/trading 的真实 transfer 编排；但资本系统仍有几处关键语义停留在字段或 event type 占位，导致“能跑但不可解释”。
- 最明显的缺口集中在五处：`buffer_account` 只有壳子、`MidPriceCaptured` / `InternalNettingSettled` 没有主链、`profit_target_value` 没有触发闭环、`InvestorProjection` / `SignalProjection` 没有查询面、`reconciliation` 仍是过于粗糙的单标量比对。
- 这些缺口如果继续分散修补，会让 core/app 的职责进一步漂移：core 不掌握资本真相，app 侧却要拼装余额解释、告警与聚合，最终破坏 replay 一致性。
- 本 RFC 的目标不是引入完整 capital ledger，而是在既有约束下补齐“最小可解释闭环”：让 buffer、内冲抵、利润告警、聚合查询和对账升级都能落在当前事件溯源模型内，且具备可回放、可测试、可回滚的边界。

## 目标与非目标

### 目标

- 在 `libraries/signal-trader` 中补齐 `buffer_account` 的最小真实语义，并保留 `source_subscription_id` 级别的审计链。
- 让同一 `product_id` 内部互相抵消的目标变化不再“无痕”，而是经由 `MidPriceCaptured` + `InternalNettingSettled` 进入事件流。
- 在账户快照链路上打通 `profit_target_value -> AlertTriggered(type=profit_target_reached)` 的最小闭环。
- 为 `InvestorProjection` / `SignalProjection` 提供 query-time derived 只读查询，不新增新的真相事件。
- 对 reconciliation 做小步升级：引入 tolerance / rounding / explanation 字段，提升可解释性，但不升级为 full capital ledger。

### 非目标

- 不新增 SQL schema，不要求 app 侧落新的持久化表。
- 不引入完整多账户、多币种、跨 transfer 的统一 capital ledger。
- 不把 `profit_target_value` 升级为自动平仓动作；首版只做告警，不自动提交 `direction=0`。
- 不要求引入新的市场数据接口；`MidPriceCaptured` 首版允许使用 `submit_signal.entry_price` 作为最小价格证据来源。
- 不在本轮重写 runtime health / observer 主链；app 只做快照、测试、审计口径的最小配合。

## 定义

- `buffer_account`：投资者独立缓冲池；本轮首版只承接 `precision_lock`，属于该投资者 VC 体系，不进入公共池。
- `precision lock`：某次目标仓位计算后，因为 `lot_size` / rounding 约束暂时无法形成可执行仓位的金额占用。
- `internal netting`：同一 `product_id` 下多个 subscription 的目标变动互相抵消，导致 `external_order_delta = 0`，但 subscription 级别仍发生经济权益迁移。
- `InvestorProjection`：按 `investor_id` 聚合的只读投影视图，来源于现有 subscription、buffer、reconciliation 等 snapshot 派生信息。
- `SignalProjection`：按 `signal_key` 聚合的只读投影视图，展示该信号下各 subscription 的目标仓位、已结算仓位、预算与 buffer 归因。

## 设计提案

### 1. buffer_account 最小闭环

- 首版只做一个原因：`precision_lock`。
- 守恒关系冻结为：

```text
released_vc_total = funding_account + trading_account + precision_locked_amount
buffer_amount = precision_locked_amount
available_vc = funding_account
```

- 说明：该守恒关系先按单个 subscription 计算，再把 `precision_locked_amount` 汇总进 investor 级 `buffer_account`；不是直接把 investor 总 buffer 回写到每个 subscription。

- 本轮不处理 `lot_residual` / `rounding_delta` / `fee_hold`，避免一次性把多种资本残差都塞进来。
- 语义落点放在 core helper：当 `computeTargetPosition` 因 `lot_size` 下取整后无法把全部已释放预算转换成可执行仓位时，将那部分“已释放但暂不可交易”的金额计入 `precision_locked_amount`，并从 `funding_account` 中扣除。
- `InvestorBufferAccount.sources` 首版只追加一种受控来源：`{ reason: 'precision_lock', source_subscription_id, amount, event_id }`。
- `buffer_amount` 表示当前 buffer 总额；`precision_locked_amount` 表示其中不可交易的部分。首版二者数值保持一致，不在本轮拆更多子类型。
- reconciliation 本轮只把 buffer 暴露在 explanation 中，不把它并入 mismatch 主判定。

### 2. internal netting 触发条件与事件设计

- 触发条件冻结为：
  - 同一 `product_id`；
  - 某次 `submit_signal` 后，subscription 级 target 发生变化；
  - product 级汇总后 `external_order_delta = 0`；
  - 至少存在两个方向相反或一增一减的 subscription 变化；
  - 当前 `pending_order_qty = 0`，且不存在未完成的部分成交/挂单状态。
- 当满足条件时，不生成 `OrderSubmitted`，而是追加两类事件：
  - `MidPriceCaptured`：记录 `product_id`、`price`、`source`。首版 `source` 固定允许 `submit_signal.entry_price`，值不足时不做 netting，只退回“仅变 target、不结算 settled”的保守语义。
  - `InternalNettingSettled`：记录 `product_id`、`settled_qty`、`attribution`，并只新增 `mid_price_event_id` / `signal_id` 这类引用字段；价格本身不重复写入该事件。
- reducer 在处理 `InternalNettingSettled` 时，按 attribution 把相应数量直接写入各 subscription 的 `settled_position_qty`，同时更新 `last_entry_price` / 相关 buffer 解释；这样 replay 后可以看到“为什么外部没下单但账本变了”。
- 内冲抵只解决“无外部订单但有内部权益迁移”的缺口，不尝试在本轮做复杂 realized PnL ledger；首版只保证仓位与 attribution 可解释。

### 3. profit target alert 触发链

- 触发入口仍选择 `capture_authorized_account_snapshot`，因为它已经是 live/paper 都共用的账户真相输入。
- 但首版不把它宣称为“investor 真正达标”，而是降级成 account-scoped advisory alert：
  - core 基于当前 snapshot 找出“当前 runtime/account 下配置了 `profit_target_value` 的 subscription candidates`
  - 若账户观察值超过最小阈值条件，则追加 `AlertTriggered(type=profit_target_reached)`
  - 事件只写已有结构：`subscription_id?` + `message`
- `message` 中携带最小解释文本：`account_id`、`snapshot_id`、candidate subscription ids、target/observed 摘要。
- 首版阈值口径采用“账户观察值的 advisory threshold”，不做 investor 真相宣告，不做 mark-to-market 引擎，也不尝试在 shared account 下精确拆每条 subscription 盈亏。
- 为避免重复告警，同一 `snapshot_id` 最多触发一次 advisory alert；跨 snapshot 重复触发允许，由上层聚合去重。

### 4. Investor / Signal projection 查询设计

- 查询面保持 query-time derived，不新增真相事件，也不要求 app 落额外 projection 表。
- `QueryProjectionRequest` 新增：
  - `{ type: 'investor'; investor_id: string }`
  - `{ type: 'signal'; signal_key: string }`
- `InvestorProjection` 最小字段建议：
  - `investor_id`
  - `subscription_ids`
  - `active_subscription_count`
  - `available_vc_total`
  - `funding_account_total`
  - `trading_account_total`
  - `buffer_amount`
  - `precision_locked_amount`
  - `profit_target_value_total?`
- `SignalProjection` 最小字段建议：
  - `signal_key`
  - `product_id`
  - `subscription_ids`
  - `target_net_qty`
  - `settled_net_qty`
  - `available_vc_total`
  - `buffer_amount_total`
  - `active_subscription_count`
- 这些 projection 统一在 `query-projection.ts` 内从 refresh 后的 snapshot 派生，严格限制为 totals / ids / counts，不混入 reconciliation explanation、策略语义或 transfer 状态。

## 数据模型 / 接口

### 事件与快照扩展

- `MidPriceCapturedEvent.payload`
  - 保留：`product_id`、`price`、`source`
  - 兼容策略：`source` 首版允许 `'submit_signal.entry_price'` 之类固定字符串，后续可 append-only 增加市场数据来源。
- `InternalNettingSettledEvent.payload`
  - 现有：`product_id`、`attribution`、`settled_qty`
  - 建议新增：`mid_price_event_id?: string`、`signal_id?: string`
  - 兼容策略：旧事件缺字段时 reducer 只做仓位结算，不做价格归因增强。
- `InvestorBufferAccount.sources[]`
  - 建议字段：`source_subscription_id`、`reason`、`amount`、`event_id`
  - 兼容策略：读取旧 snapshot 时若缺 `reason`，默认视为 `precision_lock`。
- `ReconciliationProjection`
  - 建议新增：`tolerance?: number`、`difference?: number`、`rounded_projected_balance?: number`、`explanation?: string`
  - 兼容策略：缺字段时按旧逻辑展示。

### 查询接口

- `queryProjection(state, { type: 'investor', investor_id })` 返回 `InvestorProjection | undefined`。
- `queryProjection(state, { type: 'signal', signal_key })` 返回 `SignalProjection | undefined`。
- 不新增 command；上述能力全部通过现有 event + reducer + query 派生。

## 错误语义

- `internal netting` 缺最小价格证据时，系统不应伪造 `MidPriceCaptured`；应回退为“不产生 internal settlement event”，保持 fail-close，可通过测试验证。
- `profit_target_reached` 属于 advisory alert，不改变 `mode`，也不阻止后续命令；若告警追加失败，则整个命令追加失败，与现有 append-only 语义一致。
- reconciliation mismatch 仍保持当前 fail-close：进入 `audit_only`，但判断从“严格相等”升级为“先 rounding，再比较 tolerance”。超出 tolerance 才算 mismatch。
- query 派生失败（例如不存在 investor / signal）返回 `undefined`，不抛异常，不追加事件。
- 所有新增 helper 必须是确定性的纯函数；同一事件流 + 同一 `clock_ms` + 同一 reducer 版本必须得到相同 buffer / projection / reconciliation 结果。

## reconciliation 小步升级

- 继续保留单账户、单标量的外层模型：`AuthorizedAccountSnapshotCaptured -> ReconciliationMatched | ReconciliationMismatchDetected`。
- 本轮升级点仅限：
  - 引入 rounding 与 tolerance，避免纯浮点噪音把 runtime 打进 `audit_only`；
  - 在 projection / alert message 中暴露 `difference` 与 `explanation`，方便 operator 判断是 rounding、buffer lock 还是真实偏差。
- 不做：
  - 多账户汇总 reconciliation；
  - 多币种 FX 归一；
  - transfer pending / settled 的完整账实映射；
  - full capital ledger。

## 备选方案

### 方案 A：把 buffer / profit target / projection 继续放在 app 层补丁实现

- 放弃原因：会复制 core 公式，破坏 replay 与 query 一致性；paper/live 的资本语义会继续分叉。

### 方案 B：直接升级为完整 capital ledger 与多账户 reconciliation

- 放弃原因：超出本轮 scope，也与“不新增 SQL schema”“app 只做最小配合”的约束冲突；高概率把当前可交付任务拖成新 epic。

### 方案 C：internal netting 不落事件，只在 product target 相消时视为 no-op

- 放弃原因：这会继续保留“账本无痕变化/权益迁移不可追溯”的核心缺陷，违背根 RFC 对内冲抵必须可审计的要求。

## 安全考虑

- `MidPriceCaptured.source` 首版只接受受控枚举，禁止把任意外部 metadata 直接写入事件，防止审计流注入垃圾字段或敏感数据。
- buffer 来源 `reason` 使用受控枚举，避免调用方把任意字符串作为会计原因写入核心快照。
- query 新增 investor / signal 只读投影，不暴露写路径，不改变 runtime 权限模型。
- reconciliation 的 tolerance 必须是固定策略或受控配置，不能由外部请求随意传入，否则会把 mismatch 逃逸成静默接受。
- `profit_target_reached` 告警不得包含敏感 credential / account secret，只保留 `account_id`、`snapshot_id` 等可审计标识。
- 任何 helper 若出现非有限数值（`NaN` / `Infinity`），必须 fail-close：不写 event，测试覆盖该输入校验。

## 向后兼容、灰度与回滚

- 新增字段采用 append-only 兼容策略；旧事件流缺少这些字段时，reducer 仍可重放。
- 首版灰度顺序：先 core 单元测试 + replay 测试，再放开 app 查询面与 runtime 快照告警测试。
- 若 internal netting reducer 语义不稳定，可单独回滚到“只保留 event type 占位，不在 submit path 触发”，不影响其他 buffer / projection / reconciliation 交付。
- 若 reconciliation tolerance 升级导致 operator 误判，可回滚到旧的严格相等实现；若 buffer 口径引发 projected balance 异常，可暂时把 buffer 排除出 reconciliation explanation，但保留 query 能力。
- 回滚原则：优先关闭新增派生语义，不删除历史事件；历史事件保持可读，必要时由 reducer 兼容旧字段并忽略新字段。

## 测试计划

- buffer：验证 `precision_lock` 会进入 `investor_buffers`，且可通过 `source_subscription_id + reason + event_id` 追溯。
- internal netting：验证同一 `product_id` 下 target 互相抵消且 `external_order_delta = 0` 时，会追加 `MidPriceCaptured` 与 `InternalNettingSettled`，且 reducer 后 `settled_position_qty` 可回放一致。
- internal netting 前提：存在 pending order / partial fill 时不得触发 internal netting。
- netting fail-close：缺 `entry_price` 证据或证据非法时，不追加 internal settlement 事件。
- profit target：在 `capture_authorized_account_snapshot` 路径上，当账户达到 advisory threshold 时触发 `profit_target_reached`，且同一 `snapshot_id` 不重复触发。
- projection query：`investor` / `signal` 查询能返回聚合结果，且与 `subscription` / `product` 现有视图口径一致。
- reconciliation：覆盖 rounding/tolerance 边界；纯浮点误差不进入 mismatch，真实偏差仍进入 `audit_only`，buffer 只出现在 explanation 中。
- app 最小配合：runtime / service 测试验证新 query 类型白名单、快照触发告警链路与审计可见性。
- replay：同一事件流全量重放后，buffer、projection、reconciliation 字段与增量执行结果一致。

## 风险与未决问题

### 主要风险

- internal netting 若直接修改 settled 仓位但价格归因不足，后续 realized PnL 扩展会受限；因此首版必须至少把价格证据 event 关联清楚。
- profit target 在 shared account 上只做保守聚合，可能无法精确表示单 subscription 盈亏；本轮接受“先告警、不过度自动化”的取舍。
- reconciliation 增加 explanation / tolerance 后，短期内 operator 需要适应新的解释口径，文档与测试必须一起交付。

### Open Questions

- `profit_target_value` 的 investor 口径是否以后统一提升到 profile 级，而不是 subscription 级复制字段？本轮不阻塞实现，但需要后续清理。
- `InternalNettingSettled` 是否要在下一轮显式沉淀 realized/unrealized PnL 归因结构？本轮先不展开。
- 当一个 investor 订阅多个 product 且共用账户时，profit target 是否需要更强的账户归属策略？本轮先接受账户级保守告警。

## 里程碑

1. 核心账本语义：统一 buffer helper、快照字段扩展、reducer 接线。
2. 内冲抵闭环：submit path 触发 `MidPriceCaptured` / `InternalNettingSettled`，replay 测试通过。
3. 查询与告警：`investor` / `signal` projection、profit target alert、reconciliation explanation/tolerance 完成。
4. app 最小配合与验收：白名单查询、快照/审计测试、文档与报告补齐。

## 落地计划

### 预期文件变更点

- `libraries/signal-trader/src/types/events.ts`：补充 netting / alert 相关 payload 字段。
- `libraries/signal-trader/src/types/snapshot.ts`：扩展 buffer source、projection query 类型与 reconciliation 字段。
- `libraries/signal-trader/src/domain/*`：新增或抽取 buffer / netting / profit-target / reconciliation helper，保持纯函数。
- `libraries/signal-trader/src/domain/reducer.ts`：实现 `MidPriceCaptured` / `InternalNettingSettled` 的 reducer 语义，并接入 buffer / reconciliation 解释字段。
- `libraries/signal-trader/src/engine/dispatch-command.ts`：在 `submit_signal` 与 `capture_authorized_account_snapshot` 路径接入内冲抵与 profit target alert。
- `libraries/signal-trader/src/engine/query-projection.ts`：新增 investor / signal 只读派生查询。
- `libraries/signal-trader/src/index.test.ts` 及相关测试：补充 buffer、netting、profit target、projection、reconciliation 回归。
- `apps/signal-trader/**`：仅做 query 白名单、快照告警链路、最小集成测试与审计可见性适配。

### 验证步骤

- 跑 core 单测，覆盖新增事件与 reducer replay 一致性。
- 跑 app 相关测试，确认新 query 类型与快照告警链条可用。
- 人工检查 query 返回结构，确认 investor / signal / reconciliation 解释字段没有漂移。
- 人工回放一组含 internal netting 的事件流，确认无外部订单时仍可从 audit trace 解释账本变化。
