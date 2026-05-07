# RFC：signal-trader 每日固定拨资到 trading account

## 背景与问题

当前 `signal-trader` 中的 `daily_burn_amount` 实现，本质上是“账面预算按天释放 + 下单前按需补资”。这和任务目标不一致：用户要的是 funding account 每天固定把一笔资金拨到 trading account，无论当天是否下单。

这会带来三类偏差：

- 不下单日不会发生真实 transfer，运行态余额与逻辑视图脱节。
- `funding_account` / `trading_account` 当前更接近“未占用风险额度 / 已占用风险额度”，而不是“未拨资本 / 已拨资本池”。
- observer / submit / paper clock 各入口只围绕下单前缺口补资，不能表达“日拨先发生、下单只是消费已拨资本”的模型。

本 RFC 的目标是在不新增数据库 schema 的前提下，把 core projection、runtime transfer 调度和前端展示一起收敛到“daily allocation”语义，并保持 live / paper 都支持不下单日拨资。

## 目标与非目标

### 目标

- 将 `daily_burn_amount` 定义为每天固定从 funding 分配到 trading 的 tranche，而不是仅刷新账面预算。
- 重新定义 `funding_account`、`trading_account`、`available_vc`，让 query / sizing / runtime transfer 语义一致。
- 让 live observer、paper boot、paper clock 推进、submit 都能在不下单时补齐当日应拨额度。
- 保留既有 `transfer_order` / `transfer-controller` 协议，不新增数据库 schema。
- 保留 over-reserved fail-close 行为：不隐式缩仓，但禁止继续扩张。

### 非目标

- 不在本轮引入 full capital ledger、分账户多阶段清算或新的会计科目。
- 不重写前端架构，只同步必要字段文案与展示语义。
- 不修改 transfer ack 的持久化真相；真实转账仍属于宿主侧副作用。
- 不把 live 变成定时器驱动的独立 transfer worker；仍依赖现有 runtime boot / observer / submit 编排。

## 定义

- `released_vc_total`：截至 `now_ms` 已经按日拨规则释放到 trading 池的累计资本，范围 `[0, vc_budget]`。
- `funding_account`：尚未拨入 trading 的剩余预算，定义为 `vc_budget - released_vc_total`。
- `trading_account`：已经拨入 trading 的资本池总额，定义为 `released_vc_total`。
- `current_reserved_vc`：当前持仓/目标仓位已占用的风险资本。
- `available_vc`：可继续扩张的剩余容量，定义为 `max(0, trading_account - current_reserved_vc - precision_locked_amount)`。
- `over-reserved`：`current_reserved_vc > trading_account - precision_locked_amount`，表示历史已占用风险额度高于当前可交易资本池。

## 设计提案

### 1. Core：冻结新的 logical account 语义

`libraries/signal-trader/src/domain/evaluate-budget.ts` 仍然是预算投影单点，但公式改为：

- `released_vc_total = clamp(previous_released + elapsed_days * daily_burn_amount, 0, vc_budget)`
- `precision_locked_amount = getPrecisionLockedAmount(subscription, released_vc_total, current_reserved_vc)`
- `funding_account = max(0, vc_budget - released_vc_total)`
- `trading_account = released_vc_total`
- `available_vc = max(0, trading_account - current_reserved_vc - precision_locked_amount)`
- `sizing_vc_budget = max(max(0, trading_account - precision_locked_amount), current_reserved_vc)`，保证已持有风险额度不会因预算模型切换而让 sizing 反向缩小

这样处理后：

- 不下单时，`trading_account` 也会随天数增长，表达“资本池已拨到 trading”。
- 已开仓时，`available_vc` 只表示还能新增多少风险，而不是把整个未占用 released capital 混成 funding。
- `precision_locked_amount` 仍留在 trading 账户里，只是被标记为暂不可用于继续扩张。
- `queryProjection`、investor/signal 聚合与 reconciliation 继续复用同一 core projection，不在 app 层再补公式。

### 2. Runtime：把 daily allocation 补齐收口到统一同步动作

新增一个 runtime 侧同步动作，可命名为 `syncDailyAllocation`，职责是：

1. 用当前统一时钟（live = real time，paper = paper clock）读取投影后的 subscription。
2. 从 transfer adapter 查询 trading 实盘/模拟余额。
3. 计算 `target_trading_balance = max(trading_account, current_reserved_vc + precision_locked_amount) + trading_buffer_amount`。
4. 若 `observed_balance < target_trading_balance`，按差额提交 `funding_to_trading`。
5. 若 `observed_balance > target_trading_balance`，仅在 sweep 场景回收 excess，不回收已拨本金。

这个动作不是新协议，只是对既有 `queryTradingBalance`、`submitTransfer`、`pollTransfer` 的重新编排。

### 3. 调度入口

#### boot

- `paper`：worker boot 后先完成 canonical subscription 初始化，再调用一次 allocation sync，确保 D0 启动即把首日 tranche 反映到 trading balance。
- `live`：boot 完成首次 observer 之后，如果账户快照 fresh 且 runtime 可写，再执行 allocation sync；失败则沿用现有 fail-close 锁定语义。

#### observer

- `live` observer 每次拿到账户快照后，先做 freshness / account mismatch / degraded 判断，再在同一快照上执行 allocation sync 与 excess sweep。
- 只要 runtime 已正常启动，`startObserverLoop()` 会按 `poll_interval_ms` 持续驱动 observer tick；因此即使当天没有订单，也会通过 observer 周期发现 `trading_account` 已增长并补资。

#### paper clock advance

- `RuntimeManager.advancePaperClock()` 仅推进时钟还不够；推进后需要触发所有启用 paper runtime 的 allocation sync，保证“不下单推进一天”立即产生 transfer-in，而不是等下一次 submit 才补。
- 这样 query、worker、submit 仍共用同一 paper clock，但资金动作也能随时间推进即时落地。

#### submit

- `submitSignal` 在计划 effects 前后都应复用同一 `now_ms`。
- 提交前先执行 allocation sync，保证下单看到的是“已完成当日拨资”的余额。
- 原 `ensurePreOrderTransferIn` 继续存在，但语义从“按下单所需补资”收窄为“兜底补齐 trading target deficit”；这样即便 observer/boot 漏过一次，submit 仍能补齐。

### 4. transfer-out 语义

`maybeSweepTradingExcess` / `paper allocation sync` 的 target 保持为：

- `max(trading_account, current_reserved_vc + precision_locked_amount) + trading_buffer_amount`

但现在 `trading_account` 表示“已拨资本池”，因此 sweep 只回收真正高于目标池的 excess，不再因平仓后 `current_reserved_vc -> 0` 就把已分配 tranche 全部扫回 funding。这样才能满足“每天拨进去的本金会留在 trading，直到后续策略或人工调整显式回收”。盈利、人工补款等高于目标池的余额在当前 MVP 中默认视为 excess，可被 sweep 回 funding；这是本轮明确写死的策略边界。

## Data Model / Interfaces

### Core projection 字段

- `released_vc_total: number`，累计已拨资本，单调递增，封顶 `vc_budget`
- `funding_account: number`，非负，等于尚未拨入的预算余额
- `trading_account: number`，非负，等于已拨资本池总额
- `precision_locked_amount: number`，非负，不大于 `released_vc_total`
- `available_vc: number`，非负截断，不可为负
- `last_budget_eval_at: number`，只按整日推进，仍以 `DAY_MS` 为步长

### Runtime / transfer 接口约束

- 不新增 schema，不新增 transfer 表结构。
- 继续使用 `runtime.metadata.signal_trader_transfer`：`funding_account_id`、`currency`、`min_transfer_amount`、`trading_buffer_amount`。
- live runtime 冲突校验仍按 `(runtime.account_id)` 和 `(funding_account_id, currency)` 做隔离，避免多个 runtime 抢同一 trading/funding 账户。
- paper/live 都必须通过同一 `queryTradingBalance -> submitTransfer -> pollTransfer` 接口面完成动作。

### 兼容策略

- 旧 snapshot 中若没有 `released_vc_total`，继续通过现有 fallback 推断初值，但从新版本起所有 query/replay 都按新公式输出。
- 不做数据迁移脚本；兼容依赖 replay + projection 惰性刷新。

## 错误语义

- `INVALID_*` / 配置错误：不可恢复，upsert 阶段直接拒绝。
- `LIVE_TRANSFER_NOT_CONFIGURED` / `TRANSFER_CURRENCY_MISMATCH` / `TRANSFER_ACTIVE_ORDER_CONFLICT`：live fail-close，进入 `audit_only` 或 `stopped`，等待人工修复。
- `TRANSFER_TIMEOUT` / `TRANSFER_ERROR`：按现有策略锁 runtime；paper 测试中直接抛错，方便尽早暴露。
- observer 缺少 fresh account snapshot：不做 allocation sync，也不做 sweep，优先保持 fail-close。
- `over-reserved` 不是错误码，而是投影状态：允许继续持有/平仓，但 `available_vc = 0`，阻止继续加仓。

重试语义：

- 单次 sync 内可复用当前已有 transfer settle/poll 重试。
- observer / submit / boot / paper clock advance 是天然重试入口；只要配置和外部账户恢复，下一次入口会再次尝试补齐 deficit。

## Security Considerations

- 不新增写接口面；仍复用既有 transfer controller 与 runtime 健康门禁。
- live 只在 capability 有效、快照 fresh、账户匹配时允许发起 allocation transfer，避免 stale snapshot 下误拨资。
- 所有 transfer amount 继续做非负、币种匹配、最小金额判断，防止异常输入或重复噪音。
- 通过 runtime 粒度隔离 funding/trading 账户，避免跨 runtime 误复用活动转账单。
- 不新增 schema 可降低持久化攻击面，但意味着排障主要依赖 audit log；需确保 transfer_failed / transfer_completed 足够可观测。
- paper clock 只影响 paper runtime；live 不读取 offset，避免测试能力污染真实资金路径。

## 替代方案

### 方案 A：继续维持“预算释放 + 下单前补资”

优点是改动最小。

不采用原因：它直接违背“无论是否下单都要每天拨资”的目标，也无法给 `trading_account` 一个可解释的资本池语义。

### 方案 B：把 `trading_account` 定义为 `current_reserved_vc + precision_buffer`

优点是能减少 runtime transfer 频率，因为只围绕持仓需要拨资。

不采用原因：这仍然把 trading 账户当成“持仓占用量”而不是“已分配资本池”；不下单日不会增长，也会导致平仓后本金立即被 sweep 回 funding。

## 前后兼容与 rollout

- 兼容读：现有 query DTO 字段名不变，前端只更新文案与解释，不要求 API 破坏式升级。
- 兼容写：runtime config 不新增必填字段，老配置可直接启动。
- rollout 顺序：
  1. 先修改 core projection 与单测。
  2. 再接入 runtime allocation sync（paper boot / clock / submit，再 live observer）。
  3. 最后同步 UI 文案和验收测试。
- 灰度方式：优先在 paper runtime 验证 D0 / D1 / D2；再在单个 live runtime 上启用，观察 audit log 与 transfer 频率。
- 回滚方式：回退 core projection 公式与 runtime sync 接线即可；因为没有 schema 变更，回滚不需要数据迁移，只需重启 runtime 并让 projection 按旧逻辑重算。

## 验证计划

### Core

- 单测：`evaluateSubscriptionBudget` 在 D0 / D1 / D2 下输出新的 funding/trading/available 语义。
- 单测：`current_reserved_vc > trading_account` 时，`available_vc = 0` 且不产生负数账户值。
- 单测：precision lock 存在时，`trading_account = released_vc_total`，但 `available_vc` 被 `precision_locked_amount` 正确扣减。

### Paper

- 集成测试：boot 后即有 D0 tranche 对应的 transfer-in。
- 集成测试：`advancePaperClock(DAY_MS)` 后，即使不 submit，也会发生新的 transfer-in。
- 集成测试：平仓或无仓状态下，observer/sync 不会把已拨本金 sweep 回 funding，只回 excess。

### Live

- 集成测试：observer 周期内无订单但跨天时，会触发 funding->trading transfer-in。
- 集成测试：submit 前若 observer 尚未补齐，当次 submit 会兜底补齐 deficit，且 submitOrder 发生在 transfer 完成之后。
- 集成测试：transfer 配置错误、币种不一致、活动单冲突时，runtime 进入 fail-close。

### UI

- 最小验收：capital 卡片中的 funding/trading 文案与新语义一致。
- 最小验收：不下单推进时间后，前端能看到 trading 增长、funding 下降，而不是仍停留在 0 / 全额可用。

## 风险与回滚

主要风险：

- transfer 频率上升：observer / paper clock 触发后，不下单日也会多出 transfer-in。
- 旧测试假设失效：原来把 `trading_account` 当“已占用风险额度”的断言需要整体改写。
- operator 心智迁移成本：UI 若不改文案，容易继续把 funding/trading 理解成旧语义。
- live 账户余额抖动：若 observer 快照延迟或 transfer 结算延迟，可能出现短时 deficit 重试。

回滚原则：

- 先停用受影响 runtime 或切 `audit_only`，阻断新的真实 transfer。
- 回退 `evaluate-budget` 公式和 runtime allocation sync 接线。
- 重启 worker / 重新 replay，让 projection 回到旧语义。
- 保留 audit log 作为排障证据，不清理 transfer 历史。

## Open Questions

- D0 首日 tranche 是否始终等于 `daily_burn_amount`，还是需要支持“从下一整日开始拨”？当前 RFC 维持现有 D0 即可用的语义。
- 若 live observer 长时间停摆，但 submit 持续触发兜底补资，是否需要单独 audit action 标识“submit-driven allocation sync”？本轮建议先复用现有 transfer 审计，不新增 schema。

## 里程碑

1. 核心语义收口：完成 `evaluate-budget`、projection 聚合与 core 单测更新。
2. paper 闭环：完成 boot / paper clock / submit 调度接线，覆盖“不下单跨天也拨资”。
3. live 闭环：完成 observer-driven allocation sync、deficit 兜底与 excess sweep 语义收敛。
4. 展示与交付：同步 UI 文案/摘要，补齐测试报告与 review 文档。

## 落地计划

文件变更点：

- `libraries/signal-trader/src/domain/evaluate-budget.ts`：修改 logical account 公式与 sizing 推导。
- `libraries/signal-trader/src/engine/query-projection.ts`：确认 investor/signal 聚合沿用新字段含义，无额外公式漂移。
- `libraries/signal-trader/src/index.test.ts`：补 D0 / D1 / D2、over-reserved、precision lock 断言。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：抽出 daily allocation sync，并接入 boot / observer / paper submit / sweep。
- `apps/signal-trader/src/runtime/runtime-manager.ts`：paper clock advance 后触发 paper runtime allocation sync。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：补 paper/live 不下单日拨资与 sweep 断言。
- `ui/signal-trader-web/src/app.tsx` 与相关类型/展示层：同步 funding/trading 文案解释。

验证步骤：

1. 运行 library 单测，确认 projection / replay 断言通过。
2. 运行 app 测试，覆盖 paper clock、live submit、observer transfer。
3. 手动在 paper runtime 推进一天，确认不 submit 也会出现 transfer-in 审计记录。
4. 手动验证平仓后 trading 余额仍保留已拨本金，仅 excess 被 sweep。
