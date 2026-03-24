# RFC：`@yuants/app-signal-trader` 宿主接入与 live integration（Heavy）

> **Profile**: RFC Heavy (Epic/High-risk)  
> **Status**: Draft  
> **Owners**: app-signal-trader-live-integration / 人类评审  
> **Created**: 2026-03-18  
> **Last Updated**: 2026-03-18

---

## Executive Summary（<= 20 行）

- **Problem**: 仓库已具备 `@yuants/signal-trader` 事件溯源 core，但尚无一个可部署、可重放、可接现有 Yuan Terminal/vendor 生态的宿主 app；没有宿主就无法把 paper 验证闭环安全推进到 live execution。
- **Decision**: 新增 `apps/signal-trader`（包名 `@yuants/app-signal-trader`），以 **SQL 配置表 + SQL 事件仓库 + Terminal 服务面 + runtime worker** 形态承载 core library，统一支持 `paper` 与 `live` 两种运行模式。
- **Why now**: live 接入的风险不在 core 公式，而在宿主层的凭证引用、订单绑定、execution observation、重启恢复、fail-close 和部署边界；这些必须在实现前冻结。
- **Recommended live backend**: live 支持矩阵不再由 app 内部硬编码白名单冻结，而由宿主注入的 `liveVenue` / `observerProvider` 与外部观测链能力决定；首版仍要求 closed-order history、open orders 与 account snapshot 至少有一条可验证的 fail-close 路径。
- **Fail-close**: fail-close 是固定策略，不再做 runtime 级开关。所有**准入失败 / 启动前失败 / 启动恢复前置校验失败**统一停在 `stopped`；只有**已进入执行态后**再发生 secret 解析失败、订单绑定缺失、外部回报无法归因、观测超时升级、账实不符、检测到多笔同产品并发未决订单、或生成了 V1 不支持的 `modify_order` effect，才切到 `audit_only` 并停止产生新 effect。
- **Host boundary**: 宿主负责事件持久化、runtime 配置、单订阅约束、effect 执行、`internal_order_id -> external_order_id` 翻译、execution report 回灌、重启 replay、观测与告警；core library 仍然只负责事件/投影/effect 语义。
- **High risk reason**: 上游 vendor 的 `order_id` 语义不一致，`GetOrders` 不保证闭合订单历史，且当前 core 在“保留一单 modify、其余 cancel”的路径若宿主不收口，live 归因会失真。
- **V1 safety stance**: 首版 live **不放宽 core 语义**，而是在宿主层同时强制：`一 runtime = 一 product = 一 subscription = 一 in-flight external order`。因此支持路径只覆盖 `place_order / cancel_order / execution observe`；若 runtime 生成 `modify_order` effect，直接锁死到 `audit_only`，要求人工接管。
- **Migration**: 新增 SQL 表 `signal_trader_runtime_config`、`signal_trader_event`、`signal_trader_order_binding`、`signal_trader_runtime_checkpoint`，并将新 app 注册进 Rush；不要求改 node-unit / postgres-storage / vendor app 本体。
- **Rollout**: 正式 rollout 只定义 `paper -> live execution` 两阶段；live 前的“只观测联调”属于宿主外 runbook，不复用 runtime 状态机，也不把 `audit_only` 误当成灰度开关。
- **Rollback**: 任一 runtime 进入 `audit_only` 后停止新下单，只保留事件追加、重放、告警与人工排障入口；只有在“外部订单终态已确认 + binding 已补齐或明确废弃 + runtime lock 已解除”后才允许恢复。删除/禁用 runtime 配置可停止该 runtime，但不等同于自动回滚未知在途订单。

---

## 1. 背景与动机

- 根目录真源 RFC 已冻结 core domain：`signal-trader-rfc-v1-事件溯源重排版.md`。其中已经明确：事实来源是 append-only 事件流，projection 只是派生态，宿主负责真实下单、回报回灌、部署与审计闭环。
- 当前仓库已具备以下可复用模式：
  - `apps/trade-copier/src/stable.ts`：`requestSQL + listWatch + runtime fan-out` 的 app 运行形态。
  - `apps/virtual-exchange/src/credential.ts` / `general.ts` / `legacy-services.ts`：`Terminal.fromNodeEnv()`、secret 解析、service 暴露、`QueryAccountInfo` / `QueryPendingOrders` 兼容服务、`SubmitOrder/ModifyOrder/CancelOrder` 代理模式。
  - `apps/node-unit/src/index.ts`：本仓库 app 作为普通 `@yuants/*` 包即可被部署；默认本地还会托管 `@yuants/app-host` 与 `@yuants/app-postgres-storage`，因此新 app 不需要为了可部署而额外修改 node-unit。
- `libraries/signal-trader` 已实现：
  - `createEventSourcedTradingState`
  - `dispatchCommand`
  - `queryProjection`
  - `queryEventStream`
  - `applyExecutionEffects`
  - `createMockExecutionPort`
- 但从 core 到 live 之间仍缺少一层高风险宿主：
  1. 没有 runtime 配置模型，无法安全表达 `paper/live`、account、secret 引用、轮询频率和 observer 策略。
  2. 没有 SQL event store / order binding，无法在 vendor `order_id` 语义不一致时做稳定归因。
  3. 没有 execution observation 主路径与 fallback，无法回答“这个订单最终是否成交/取消/未知”。
  4. 没有 runtime replay / checkpoint / idempotency 约束，重启后无法确定是否会重复下单。
  5. 没有 SignalTrader 专属 Terminal 服务面，用户无法把 signal-trader 作为 app 宿主使用。
- 因此本 RFC 的目标不是再改 core 公式，而是冻结一个 **scope 内、可直接实现、可审计、可回滚** 的宿主方案。

## 2. 目标

- 新增 `apps/signal-trader`，包名 `@yuants/app-signal-trader`，沿用仓库现有 app / Rush / Heft 形态。
- 通过 SQL 表承载 runtime 配置、事件仓库、订单绑定、checkpoint；让 app 可以断点恢复与全量 replay。
- 暴露统一的 `SignalTrader/*` Terminal 服务，用于 runtime 配置、signal 提交、查询、重放和健康检查。
- 支持一套明确可复现的本地 `paper` 启动剧本；支持在满足严格约束时接入 live execution。
- live 默认 fail-close，且只允许 secret 引用（`secret_id` / `sign` 或等价引用），不落明文 credential。
- 明确 live 不再由 app 内部冻结 vendor/product 白名单；宿主需通过 `liveVenue` / `observerProvider` 显式声明并实现其观测与执行能力。
- 明确与现有 vendor、`"order"` 表、postgres-storage、node-unit 的关系，做到不修改这些系统也能接入。
- 给出文件/模块级落地清单、测试映射、迁移/灰度/回滚步骤。

## 3. 非目标

- 不在本轮引入新的 core domain 语义；根目录 RFC 仍是唯一真源。
- 不在 `apps/signal-trader` 中直接存储或打印明文 credential。
- 不要求修改 `apps/node-unit`、`apps/postgres-storage` 或任何 vendor app 的现有部署框架。
- 不支持首版 live 在缺少 closed-order history、open orders 与 account snapshot 交叉验证能力时“尽力而为”地下单。
- 不支持首版 live 在同一 runtime 内管理多 subscription、多 product，或把 `modify_order` 当成支持路径。
- 不把跨 runtime 资金调度、组合级净额、跨账户聚合、复杂审批流纳入首版范围。
- 不把 mock backend 暴露成生产默认能力；`createMockExecutionPort` 仍受 test / unsafe 显式开关约束。

## 4. 风险分级：为什么这是 High risk

### 4.1 风险等级

- **等级**：High。

### 4.2 原因

1. **真实资金风险**：live effect 会触发真实订单，任何重复下单、错单、归因错误都是真实损失。
2. **上游不可靠**：不同 vendor 对 `order_id` 的保留策略不同，且 `GetOrders` 通常只覆盖 open orders。
3. **观测链路不完备风险**：若没有独立的 order binding 与 order history fallback，订单终态可能永远不可判定。
4. **重启风险**：宿主若不能从事件流和 checkpoint 重建状态，可能重复执行旧 effect。
5. **当前 core 的 live 边界风险**：`libraries/signal-trader/src/engine/dispatch-command.ts` 的 `buildPlannedEffects` 允许“保留一张单并 modify，其余 cancel”。如果 live 宿主允许多 subscription / 多未决订单并发存在，则后续成交归因会变脆。

### 4.3 本 RFC 的风控立场

- **首版不通过放宽 core 来解决该风险**。
- **首版通过宿主硬约束来规避**：live runtime 强制 `single_runtime_product=true`、`single_runtime_subscription=true`、`single_inflight_order_per_product=true`，并在执行层统一做 `internal_order_id -> external_operate_order_id` 翻译。
- 已进入执行态后若检测到第二笔未决外部订单或 `modify_order` effect，直接切 `audit_only`；若在启动恢复阶段发现库内 pending 与 binding 表不一致，则停在 `stopped`，要求先修复再放行。
- 这样仍属于当前 scope 内的合理最小改动，因为风险来自宿主执行边界，而不是 core 数学或事件 schema 缺陷。

## 5. 约束（硬约束）

### 5.1 作用域约束

- 只能在以下路径内设计与实现：
  - `apps/signal-trader/**`
  - `libraries/signal-trader/**`
  - `tools/sql-migration/sql/**`
  - `rush.json`
  - `common/config/rush/**`

### 5.2 安全约束

- 不存储明文 credential；live 配置只允许 `secret_id` / `secret_sign` / 等价引用。
- fail-close 是固定行为，不做 runtime 级开关。
- 未能完成 secret 解析、账户授权、订单归因、execution observation、reconciliation 任何一环时，不产生新 external effect。

### 5.3 平台约束

- 复用 `@yuants/exchange` 的 `getPositions/getOrders/submitOrder/modifyOrder/cancelOrder`。
- 复用 `@yuants/sql` 的 `requestSQL` / `buildInsertManyIntoTableSQL` / `createSQLWriter`。
- 复用 `@yuants/secret` 的 secret 读写模型。
- 复用 `@yuants/data-account` / `@yuants/data-order` 的 `QueryAccountInfo` / `QueryPendingOrders` 服务与 channel 约定。

### 5.4 运行约束

- 首版 live 仅支持 **单 runtime、单 product、单 subscription、单 in-flight external order** 的串行执行模型。
- `paper` 可默认启用；`live` 必须显式配置并由宿主注入其执行/观测能力。
- `observer_backend` 在 V1 对 `paper` 固定为 `paper_simulated`；对 `live` 它就是宿主 live capability contract 的 canonical key，必须命中宿主 registry 中唯一一份 descriptor。

### 5.5 兼容约束

- event schema 追加式兼容；新增字段只增不删。
- SQL 表需满足 `tools/sql-migration/AGENTS.md`：幂等、单表单文件、无外键、统一时间字段。

## 6. 术语与定义

- `runtime_id`：宿主 app 内一个独立 signal-trader 运行实例的标识；一个 runtime 绑定一个执行账户和一套配置。
- `execution_mode`：`paper | live`。
- `observer_backend`：live/paper 观察 execution report 的来源策略。
- `internal_order_id`：core 侧 `OrderSubmitted` 产生的内部订单标识，默认沿用 `order_id`。
- `external_order_id`：泛指 vendor 返回的订单标识；在具体实现里拆为 `external_submit_order_id` 与 `external_operate_order_id`。
- `binding`：`internal_order_id <-> external_*_order_id <-> runtime/account` 的稳定映射关系。
- `checkpoint`：runtime 最近一次成功持久化并完成 replay 的事件偏移与摘要信息。
- `audit_only`：只允许记录事件、观测、告警、查询，不允许产生新的 `submit/modify/cancel` effect。

---

## 7. 总体设计（端到端）

### 7.1 总体架构图（文字）

```text
Signal source / Operator
  -> Terminal service: SignalTrader/SubmitSignal
  -> App runtime gateway
  -> core library dispatchCommand(...)
  -> append events to SQL event store
  -> rebuild snapshot / checkpoint
  -> derive planned_effects
  -> execution adapter
       - paper backend: app-hosted simulated fills
       - live backend: @yuants/exchange + secret reference
  -> write order binding
  -> observer loop
       - main: SQL "order" history + QueryPendingOrders/GetOrders + QueryAccountInfo/GetPositions
       - fallback: open orders only / account info only
  -> normalize observation -> apply_execution_report / capture_authorized_account_snapshot
  -> append events to SQL event store
  -> query services / metrics / alerts
```

### 7.2 组件边界

#### A. `apps/signal-trader`（新增，宿主主包）

- 负责：
  - runtime 配置读取与动态启停
  - SQL event store / checkpoint / order binding 持久化
  - Terminal 服务暴露
  - effect 执行
  - live/paper observer
  - fail-close / audit_only / 告警
- 不负责：
  - 重新定义 core domain 规则
  - 保存明文 credential

#### B. `libraries/signal-trader`（已有）

- 继续负责：事件语义、projection、planned effects、query/replay。
- 首版 live **不要求核心语义补丁**；通过宿主串行化约束规避“保留一单 modify，其余 cancel”的危险边界。

#### C. 现有 vendor / Terminal 生态

- 作为执行与观测依赖，不作为本 RFC 的改造目标。
- 推荐依赖会写 `"order"` 表的 vendor/sidecar 作为 live backend。

### 7.3 首版设计决策

- 选择 **SQL 事件仓库**，不引入额外 MQ。
- 选择 **runtime 进程内 worker**，不额外拆成多包。
- 选择 **service + polling observer**，而不是事件总线或 WS 订阅优先。
- 选择 **host-level serialization**，而不是在首版 live 修改 core 以支持复杂订单 rebasing。

### 7.4 文件/模块级建议

#### 新增 `apps/signal-trader`

- `apps/signal-trader/package.json`
- `apps/signal-trader/src/index.ts`：app 入口，初始化 Terminal、SQL、runtime manager。
- `apps/signal-trader/src/config/types.ts`：runtime 配置、observer backend、service request/response 类型。
- `apps/signal-trader/src/config/runtime-config-repository.ts`：读取/写入 `signal_trader_runtime_config`。
- `apps/signal-trader/src/storage/event-store.ts`：事件写入、按 runtime 读取、幂等检查。
- `apps/signal-trader/src/storage/order-binding-repository.ts`
- `apps/signal-trader/src/storage/checkpoint-repository.ts`
- `apps/signal-trader/src/runtime/runtime-manager.ts`：listWatch config，创建/销毁 runtime worker。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：单 runtime 主循环。
- `apps/signal-trader/src/runtime/runtime-replay.ts`：重启恢复与 checkpoint。
- `apps/signal-trader/src/runtime/runtime-health.ts`
- `apps/signal-trader/src/services/signal-trader-services.ts`：统一注册 `SignalTrader/*` 服务。
- `apps/signal-trader/src/execution/paper-execution-adapter.ts`
- `apps/signal-trader/src/execution/live-execution-adapter.ts`
- `apps/signal-trader/src/execution/credential-resolver.ts`：只解析 secret 引用。
- `apps/signal-trader/src/observer/sql-order-history-observer.ts`
- `apps/signal-trader/src/observer/open-orders-observer.ts`
- `apps/signal-trader/src/observer/account-snapshot-observer.ts`
- `apps/signal-trader/src/observer/observation-normalizer.ts`
- `apps/signal-trader/src/metrics.ts`
- `apps/signal-trader/README.md`

#### 可能涉及 `libraries/signal-trader`

- `libraries/signal-trader/src/index.test.ts`：补充“单 product 单 in-flight order”宿主假设的回归测试说明样例。
- 如评审认为需要公开更多 query helper，再评估是否仅新增只读 helper，不改 domain 语义；**本 RFC 首选不改**。

#### 需要新增 SQL 迁移

- `tools/sql-migration/sql/signal_trader_runtime_config.sql`
- `tools/sql-migration/sql/signal_trader_event.sql`
- `tools/sql-migration/sql/signal_trader_order_binding.sql`
- `tools/sql-migration/sql/signal_trader_runtime_checkpoint.sql`

#### Monorepo 注册

- `rush.json`：新增 `@yuants/app-signal-trader`
- `common/config/rush/pnpm-lock.yaml`：依赖锁更新

---

## 8. runtime 配置模型

### 8.1 配置对象

```ts
interface SignalTraderRuntimeConfig {
  runtime_id: string;
  enabled: boolean;
  execution_mode: 'paper' | 'live';
  account_id: string;
  subscription_id: string;
  investor_id: string;
  signal_key: string;
  product_id: string;
  vc_budget: number;
  daily_burn_amount: number;
  subscription_status: 'active' | 'paused' | 'closed';
  contract_multiplier?: number;
  lot_size?: number;
  profit_target_value?: number;
  secret_ref?: {
    kind: 'secret_id' | 'secret_sign';
    value: string;
  };
  observer_backend: string;
  poll_interval_ms: number;
  reconciliation_interval_ms: number;
  event_batch_size: number;
  allow_unsafe_mock?: boolean; // default false, only honored in paper
  metadata?: {
    trace_id?: string;
    tags?: string[];
  };
}

interface SignalTraderRuntimeHealth {
  runtime_id: string;
  status: 'normal' | 'degraded' | 'audit_only' | 'stopped';
  lock_reason?: string;
  last_error?: string;
}
```

### 8.2 字段约束

- `runtime_id`：主键，稳定且不可复用。
- `execution_mode=paper`：
  - `secret_ref` 可为空。
  - `observer_backend` 必须为 `paper_simulated`。
- `execution_mode=live`：
  - `secret_ref` 必填。
  - `observer_backend` **不得** 为 `paper_simulated`，且必须与宿主注入的 observer provider 约定一致。
  - `allow_unsafe_mock` 必须为空或 `false`。
- `account_id`：配置值就是 canonical account id；宿主不会尝试从 secret 自动推导或覆盖它。启动时若 `QueryAccountInfo(account_id)` 不可用，则 runtime 拒绝启动。
- `subscription_id`：V1 是 runtime 内唯一 subscription，且**必须** 等于 `runtime_id`，避免多订阅分叉。
- `signal_key + product_id + subscription_id`：V1 一 runtime 只绑定一个 `product_id` 和一条 canonical subscription。
- `vc_budget / daily_burn_amount / subscription_status`：作为 canonical subscription 配置的一部分，由 runtime 在启动和配置变更时自动落 `upsert_subscription` 命令。
- `poll_interval_ms`：建议 `1000~5000`；过小容易放大 SQL / vendor 压力。
- `SignalTraderRuntimeHealth.status` 是运行时状态，不回写到 `execution_mode` 字段；`audit_only` / `degraded` / `stopped` 只出现在 health/checkpoint 中。

### 8.3 配置兼容策略

- 表结构 append-only；新增列允许为空并带默认值。
- service 请求允许忽略未知字段。
- 旧 runtime 若缺 `observer_backend`，一律按 `paper_simulated`（paper）或 **启动失败**（live）处理。
- 旧 runtime 若缺 canonical subscription 字段（`subscription_id/investor_id/vc_budget/daily_burn_amount`），一律拒绝进入执行态。

### 8.4 宿主 live capability descriptor

取消 app 内部 vendor/product 白名单后，`observer_backend` 不再只是一个字符串标签，而是 **宿主 live 能力契约的 canonical key**。

宿主必须为每个可执行的 live backend 显式声明 capability descriptor，最小结构如下：

```ts
interface LiveCapabilityDescriptor {
  key: string; // 必须等于 runtime.observer_backend
  supports_submit: boolean;
  supports_cancel_by_external_operate_order_id: boolean;
  supports_closed_order_history: boolean;
  supports_open_orders: boolean;
  supports_account_snapshot: boolean;
  supports_authorize_order_account_check: boolean;
  evidence_source: string; // runbook / 服务名 / sidecar / 文档入口
}
```

宿主还必须提供一份**显式 support matrix 产物**，V1 至少满足以下其一：

- 进程内静态 capability registry（单模块 / 单文件，可枚举全部 live backend）；
- 只读查询面（推荐：`SignalTrader/ListLiveCapabilities`），返回全部 descriptor 与其可定位证据引用。

约束：

- `runtime.observer_backend` 必须能解析到且只解析到一份 descriptor。
- descriptor 是 **允许进入 live 的前置输入**，不是可选备注。
- descriptor 缺失、key 不匹配、或能力不足时，runtime 必须在启动时 fail-close 到 `stopped`。
- descriptor 本身不要求单独落 SQL 表；V1 允许由宿主静态注入，但必须：
  - 在启动时可校验；
  - 能通过 support matrix / query 面被枚举；
  - 在审计日志 / runbook 中可追溯；
  - 能解释“为什么这个 runtime 被允许进入 live”。

runtime 在 `UpsertRuntimeConfig` 校验与 worker boot 校验时，都必须把**命中的 descriptor 快照**写入审计日志，最少包含：

- `observer_backend`
- 全部 capability 布尔位
- `evidence_source`
- `descriptor_hash`（或等价 version/hash）
- `validator_result`（accepted / rejected + missing capabilities）

V1 最小可执行 live 能力要求：

- `supports_submit=true`
- `supports_cancel_by_external_operate_order_id=true`
- `supports_closed_order_history=true`
- `supports_open_orders=true`
- `supports_account_snapshot=true`
- `supports_authorize_order_account_check=true`

说明：

- 这不是重新引入 vendor 白名单；它只把“宿主到底支持什么”从口头约定升级为显式、可审计的契约。
- 若后续要支持能力更弱但仍可安全运行的 backend，应另开 RFC 收敛新的 capability profile，而不是在运行时隐式放宽。
- `evidence_source` 不是自由文案；必须是可定位证据引用，例如 runbook 路径、sidecar 服务名、SQL writer 名称、监控面板链接或文档入口。

---

## 9. SQL 表设计

> 所有表遵循 `TEXT + TIMESTAMPTZ + 无外键 + 幂等 migration` 规范。

### 9.1 `signal_trader_runtime_config`

用途：runtime 配置源；供 `requestSQL + listWatch` 动态启停 worker。

建议字段：

- `runtime_id TEXT PRIMARY KEY NOT NULL`
- `enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `execution_mode TEXT NOT NULL`
- `account_id TEXT NOT NULL`
- `subscription_id TEXT NOT NULL`
- `investor_id TEXT NOT NULL`
- `signal_key TEXT NOT NULL`
- `product_id TEXT NOT NULL`
- `vc_budget DOUBLE PRECISION NOT NULL`
- `daily_burn_amount DOUBLE PRECISION NOT NULL`
- `subscription_status TEXT NOT NULL DEFAULT 'active'`
- `contract_multiplier DOUBLE PRECISION NOT NULL DEFAULT 1`
- `lot_size DOUBLE PRECISION NOT NULL DEFAULT 1`
- `profit_target_value DOUBLE PRECISION`
- `secret_ref_kind TEXT`
- `secret_ref_value TEXT`
- `observer_backend TEXT NOT NULL`
- `poll_interval_ms BIGINT NOT NULL DEFAULT 1000`
- `reconciliation_interval_ms BIGINT NOT NULL DEFAULT 10000`
- `event_batch_size INT NOT NULL DEFAULT 100`
- `metadata JSONB NOT NULL DEFAULT '{}'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

索引：

- `idx_signal_trader_runtime_config_enabled(updated_at)`
- `idx_signal_trader_runtime_config_account_id(account_id)`

触发器：

- `updated_at` 必须配套 `update_updated_at_column()` 触发器，符合仓库 SQL 规范。

### 9.2 `signal_trader_event`

用途：per runtime append-only 事件仓库；是宿主事实来源。

建议字段：

- `runtime_id TEXT NOT NULL`
- `event_offset BIGSERIAL NOT NULL`
- `event_id TEXT NOT NULL`
- `event_type TEXT NOT NULL`
- `schema_version INT NOT NULL`
- `reducer_version INT NOT NULL`
- `idempotency_key TEXT NOT NULL`
- `command_fingerprint TEXT NOT NULL`
- `event_created_at_ms BIGINT NOT NULL`
- `payload JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

主键与约束：

- `PRIMARY KEY (runtime_id, event_offset)`
- `UNIQUE (runtime_id, event_id)`
- `UNIQUE (runtime_id, idempotency_key, event_id)` 不是必须；幂等以 app 层处理为主。

索引：

- `(runtime_id, idempotency_key)`
- `(runtime_id, event_type, event_created_at_ms)`
- `GIN(payload)` 可选；首版非必须。

兼容策略：

- `payload` 原样保存 core event，不做列展开。
- schema/reducer 升级靠字段版本，不做 destructive migration。

### 9.3 `signal_trader_order_binding`

用途：解决 vendor `order_id` 语义不一致问题；连接 internal/external/order history/account/runtime。

建议字段：

- `runtime_id TEXT NOT NULL`
- `internal_order_id TEXT NOT NULL`
- `external_submit_order_id TEXT`
- `external_operate_order_id TEXT`
- `account_id TEXT NOT NULL`
- `product_id TEXT NOT NULL`
- `signal_id TEXT NOT NULL`
- `submit_effect_id TEXT NOT NULL`
- `binding_status TEXT NOT NULL`  
  值域：`submitted | accepted | partially_filled | filled | cancelled | rejected | unknown | timeout`
- `observer_backend TEXT NOT NULL`
- `first_submitted_at_ms BIGINT NOT NULL`
- `terminal_status_changed_at_ms BIGINT`
- `last_observed_source TEXT`
- `last_observed_at_ms BIGINT`
- `last_report_id TEXT`
- `last_error TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

主键与索引：

- `PRIMARY KEY (runtime_id, internal_order_id)`
- `UNIQUE (runtime_id, external_submit_order_id)` where external_submit_order_id is not null
- 索引 `(account_id, product_id, updated_at)`
- 索引 `(binding_status, updated_at)`

约束：

- 若 `execution_mode=live`，`external_submit_order_id` 在 `submitOrder` 成功后必须尽快落库。
- `external_operate_order_id` 是宿主真正用于 cancel / observe 的目标标识；V1 对 OKX 它等于交易所 `ordId`。
- 即使 vendor 返回的 `order_id` 与 internal 相同，也要显式写 binding，不能省略。
- V1 若无法确定 `external_operate_order_id`，runtime 直接锁死到 `audit_only`，不继续 live。

触发器：

- `updated_at` 必须配套 `update_updated_at_column()` 触发器。

### 9.4 `signal_trader_runtime_checkpoint`

用途：加速 replay 与重启恢复；不是事实源。

建议字段：

- `runtime_id TEXT PRIMARY KEY NOT NULL`
- `last_event_offset BIGINT NOT NULL`
- `last_event_id TEXT NOT NULL`
- `snapshot_json JSONB NOT NULL`
- `snapshot_hash TEXT NOT NULL`
- `health_status TEXT NOT NULL`
- `lock_reason TEXT`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

约束：

- checkpoint 仅作为缓存，可丢弃重建。
- replay 时若 `snapshot_hash` 校验失败，忽略 checkpoint，回退到全量 event replay。

触发器：

- `updated_at` 必须配套 `update_updated_at_column()` 触发器。

### 9.5 `signal_trader_runtime_audit_log`

用途：记录 **不可变 runtime 审计线索**，支撑 live admission、人工接管、回滚与事故复盘。

建议字段：

- `seq BIGSERIAL PRIMARY KEY`
- `runtime_id TEXT NOT NULL`
- `action TEXT NOT NULL`
- `operator TEXT`
- `note TEXT`
- `evidence TEXT`
- `detail JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

最小记录范围：

- capability admission 校验（`upsert` / `boot`）
- `BackfillOrderBinding`
- `UnlockRuntime`
- `DisableRuntime`
- runtime 进入 `audit_only` / `stopped` / `degraded` 的关键原因

约束：

- append-only，不做 update/delete 作为正常路径。
- 至少保证按 `runtime_id + created_at DESC` 可查询。
- `detail` 必须能容纳 `descriptor_hash`、`validator_result`、operator note、evidence 引用等结构化字段。

### 9.6 与现有 `"order"` 表的关系

- `tools/sql-migration/sql/order.sql` 已定义通用订单历史表。
- 本 RFC **不改** `"order"` 表结构；宿主只读它。
- V1 live 推荐接入“持续写 `"order"` 历史表”的 observer 路径，但不再把具体 vendor/product 写死在 app 契约里。

---

## 10. Terminal 服务面（`SignalTrader/*`）

### 10.1 对外服务

1. `SignalTrader/UpsertRuntimeConfig`
   - 写 runtime 配置表。
   - 配置写入成功后，会先执行 live admission 校验并写 runtime audit log；若 admission 不通过，runtime 固定停在 `stopped`，但配置仍保留供 operator 排障。
   - 配置写入成功后，runtime 会把配置镜像为唯一 canonical subscription（通过内部 `upsert_subscription` 命令完成）。
2. `SignalTrader/ListRuntimeConfig`
   - 查询 runtime 配置。
3. `SignalTrader/ListLiveCapabilities`
   - 只读返回宿主当前声明的 support matrix。
   - 每项至少包含 capability 布尔位、`evidence_source`、`descriptor_hash`。
4. `SignalTrader/SubmitSignal`
   - 输入：`runtime_id + submit_signal command`。
   - 行为：串行入 runtime worker；不直接在 service handler 里下单。
   - 约束：`signal_key/product_id` 必须与 runtime 配置一致。
5. `SignalTrader/QueryProjection`
   - 查询 subscription/product/audit/reconciliation 投影。
6. `SignalTrader/QueryEventStream`
   - 查询 runtime 事件流。
7. `SignalTrader/ReplayRuntime`
   - 强制丢弃 checkpoint 并 replay。
8. `SignalTrader/GetRuntimeHealth`
   - 返回 `normal | audit_only | degraded | stopped`，以及最后一次 observer/error 信息。
9. `SignalTrader/DisableRuntime`
   - 将 runtime 配置改为 disabled；worker 停止新执行。
10. `SignalTrader/BackfillOrderBinding`
    - 仅用于人工接管场景。
    - 为未知在途订单补齐 `external_submit_order_id/external_operate_order_id` 与 terminal status 证据。
11. `SignalTrader/UnlockRuntime`
    - 仅在 operator 已确认“无未知在途订单 + binding 已补齐或明确废弃”后允许调用。
    - 必须附带 operator、时间和证据来源。

### 10.2 内部服务/适配

- 不新增新的通用 Terminal 协议，优先复用：
  - `QueryAccountInfo`
  - `QueryPendingOrders`
  - 以及 `@yuants/exchange` 适配的 `getPositions/getOrders/submitOrder/modifyOrder/cancelOrder`

### 10.3 服务语义约束

- 所有写请求必须返回：
  - `runtime_id`
  - `accepted: boolean`
  - `reason?`
  - `correlation_id`
- `SubmitSignal` 只表示“进入宿主命令队列并成功 append signal-related events”，**不保证已经成交**。
- capability admission、`BackfillOrderBinding`、`UnlockRuntime`、`DisableRuntime` 都必须写入 `signal_trader_runtime_audit_log`。
- `BackfillOrderBinding` / `UnlockRuntime` 只能在 runtime 当前为 `audit_only` 时调用，且必须记录 operator note。
- `stopped` 不是 operator 直接 `UnlockRuntime` 的目标状态；它只能通过修配置/补宿主能力/重新 upsert 恢复。

---

## 11. mock / paper 执行链路

### 11.1 首版建议

- **首版本地跑通默认使用 `paper`，不是 `mock`**。
- 原因：`createMockExecutionPort` 在非 test 环境需要 `SIGNAL_TRADER_ALLOW_UNSAFE_MOCK=true`，不适合作为默认开发路径。

### 11.2 paper 链路

1. 启动 app，runtime 配置 `execution_mode=paper`、`observer_backend=paper_simulated`，并带上 canonical subscription 字段（`subscription_id/investor_id/vc_budget/daily_burn_amount/...`）。
2. `SignalTrader/SubmitSignal` -> `dispatchCommand` -> event store。
3. worker 从 `planned_effects` 生成模拟 external result：
   - `place_order` => 立即生成 internal/external binding（external 可等于 internal）
   - 按固定策略回灌 `accepted -> filled`，或按测试脚本制造 partial/rejected
4. 通过同一 observation normalizer 生成 `apply_execution_report` 命令，继续回灌到 core。
5. 定时根据 projection 生成 `capture_authorized_account_snapshot`，验证 replay 与对账。

### 11.3 本地 paper 可复现剧本

RFC 不再宣称“单命令即可完成所有依赖启动”。首版验收以**明确可复现剧本**为准：

1. 启动 `@yuants/app-host`。
2. 启动 `@yuants/app-postgres-storage`，确保 `SQL` Terminal service 可用。
3. 执行 `tools/sql-migration/sql/` 中包含 `signal_trader_*` 的 migration。
4. 启动 `@yuants/app-signal-trader`。
5. 调用 `SignalTrader/UpsertRuntimeConfig(execution_mode=paper, observer_backend=paper_simulated, canonical subscription fields...)`。
6. 调用 `SignalTrader/SubmitSignal`。
7. 调用 `SignalTrader/QueryProjection` 与 `SignalTrader/QueryEventStream`，确认 event -> effect -> report -> projection 闭环。

README 和最终交付文档必须把以上步骤具体化为可复制命令；如果后续补了 `dev:paper` 脚本，它只是便捷入口，不是 RFC 级前提。

### 11.4 mock 的定位

- `libraries/signal-trader/src/ports/mock-execution-port.ts` 继续作为测试/显式 unsafe 开发工具。
- app 不把 mock 做成默认生产路径；若要接入，只允许：
  - `execution_mode=paper`
  - `allow_unsafe_mock=true`
  - 进程环境显式设定 `SIGNAL_TRADER_ALLOW_UNSAFE_MOCK=true`

---

## 12. live 执行链路

### 12.1 主路径

1. runtime 启动时：
   - 读取 config
   - 解析 `secret_ref`
   - 检查 `observer_backend` 是否命中宿主 capability registry 中唯一一份 descriptor
   - 检查宿主已注入与该 backend 相匹配的 observer / execution 能力
   - 把 descriptor 快照 + `descriptor_hash` + validator result 记入 audit log
   - 检查 account 对应 `"order"` 表最近是否有更新；没有则拒绝进入 live 并停在 `stopped`
2. `SubmitSignal` 进入 runtime worker 串行队列。
3. worker 根据 checkpoint + event replay 得到当前 state。
4. `dispatchCommand` 生成 `planned_effects`。
5. 宿主做 preflight：
   - 同 `(runtime_id, product_id)` 是否已有未决 binding
   - `snapshot.mode` 是否为 `normal`
   - secret/account 是否仍可用
   - 本次 `planned_effects` 不得包含 `modify_order`
6. 调 `applyExecutionEffects` + `authorize_order`。
   - 若 `authorize_order` 返回的 `account_id` 与 runtime 配置 `account_id` 不一致，立即拒绝执行并切 `audit_only`。
   - `cancel_order` 必须先通过 binding 把 `internal_order_id` 翻译为 `external_operate_order_id`，再调用外部 venue。
7. `submitOrder` 返回后立即写 `signal_trader_order_binding`：
   - internal_order_id
   - external_submit_order_id
   - external_operate_order_id
   - runtime/account/product/signal
8. observer 轮询：
   - `"order"` 表读取终态/成交历史（推荐主来源）
   - `QueryPendingOrders` / `getOrders` 读取 open orders
   - `QueryAccountInfo` / `getPositions` 做账户快照与兜底核验
9. normalizer 把观测结果转成：
   - `apply_execution_report`
   - `capture_authorized_account_snapshot`
10. 事件追加后更新 checkpoint、metrics、health。

### 12.2 推荐 backend

- **推荐的首版 live backend 类型**：具备 closed-order history、open orders 与 account snapshot 交叉验证能力的 observer backend。

满足条件：

- 目标 account 使用 `apps/vendor-okx/src/order.ts` 这类 sidecar，会把订单历史持续写入 SQL `"order"` 表；
- open orders 还能通过 `QueryPendingOrders` 或 `getOrders` 拿到；
- 账户快照能通过 `QueryAccountInfo` 或 `getPositions` 获取。

原因：

- `"order"` 表能补足闭合订单/最终成交信息；
- 仅靠 open orders 无法稳定拿到 filled/cancelled/rejected 终态；
- 这正是首版 live 的关键安全护栏。

### 12.3 不支持 / 降级情况

#### 不支持进入 live

- `observer_backend` 没有与宿主 observer provider 建立可执行映射
- 未提供 capability descriptor / support matrix，或 descriptor 与运行时注入不一致
- 缺少 closed-order history，且也无法通过其他服务稳定拿到终态
- 无法拿到账户快照
- `submitOrder` 后拿不到可稳定落库的 `external_submit_order_id/external_operate_order_id`
- 本次 effect 里出现 `modify_order`

处理方式：

- runtime 启动失败，状态固定为 `stopped`；需修配置/宿主注入后重新 upsert 或重新 enable。

#### 允许降级但不继续下单

- SQL `"order"` 表暂时延迟或单次查询失败
- `QueryPendingOrders` 短时超时

处理方式：

- 进入 `degraded`；若超过阈值（例如 3 个 poll interval）仍无法恢复，切 `audit_only`。

---

## 13. live execution report 观测策略

### 13.1 目标

- 在上游不可靠时，尽可能得到 **可归因、可回放、可解释** 的 execution report。
- 做不到时宁可停，不做“猜测成交”。

### 13.2 主路径（推荐）

按优先级合并三类证据：

1. **Closed-order history（推荐是 SQL `"order"` 历史表）**
   - 负责终态：`filled / cancelled / rejected / partially_filled`
   - 负责补充 `traded_volume / traded_price / updated_at`
2. **Open orders（`QueryPendingOrders` / `getOrders`）**
   - 负责当前未决集合
   - 负责检测已从 open list 消失但未见终态的异常情况
3. **Account snapshot（`QueryAccountInfo` / `getPositions`）**
   - 负责位置/权益交叉核验
   - 负责生成 `capture_authorized_account_snapshot`

### 13.3 Normalizer 规则

- 若 binding 找到 `external_operate_order_id`，且 `"order"` 表存在同订单终态，优先生成对应 `apply_execution_report`。
- 若 open orders 仍包含该单，则维持 `accepted/partially_filled` 观察态，不重复回灌相同 report。
- 若 open orders 已消失，但历史表未出现，且账户仓位/权益也无法解释变化：
  - 记为 `unknown`
  - 记录错误
  - 切 `audit_only`
- 对账判据在 V1 只冻结为 `QueryAccountInfo(account_id).money.balance`；`equity/positions` 仅作解释性证据，不作为通过/失败主判据。

### 13.4 fallback

- `paper_simulated`：paper 专用，宿主自生成 report。
- live backend 由宿主注入；若缺少 closed-order history / open orders / account snapshot 这套最小观测闭环，直接停在 `stopped`，不做“open orders only”降级执行。

### 13.5 何时进入 `audit_only`

任一条件满足即切换：

- binding 缺失或一对多冲突
- `authorize_order.account_id` 与 runtime 配置 `account_id` 不一致
- 同 `(runtime_id, product_id)` 检测到第二笔未决 external order
- `submitOrder` 成功但 `external_submit_order_id/external_operate_order_id` 未落 binding
- open orders 消失但没有历史终态，也无法由 account snapshot 解释
- 同一个 external order 产生互相矛盾的终态
- 生成了 `modify_order` effect
- reconciliation mismatch
- 连续 observer timeout 超过阈值

### 13.6 何时仅 `degraded`

- 单次 SQL 查询失败
- 单次 QueryPendingOrders 超时
- 单次账户快照失败

`degraded` 允许继续观测，不允许继续产生新的 effect；若恢复后人工/自动解除，可回到 `normal`。

---

## 14. 重启恢复、replay 与幂等策略

### 14.1 启动恢复

1. 读取 `signal_trader_runtime_checkpoint`
2. 从 `signal_trader_event` 按 `runtime_id` 拉取 checkpoint 之后的事件
3. 用 `replayEvents` 重建 snapshot
4. 校验：
   - snapshot mode
   - binding 未决订单数量
   - config 与 snapshot product/account 是否一致
   - config 与 canonical subscription 是否一致
5. 若任一校验失败：进入 `stopped`

### 14.2 checkpoint 策略

- 每次成功 append 新事件并完成 observation 回灌后更新 checkpoint。
- checkpoint 与 event store 必须在同一 SQL backend；但不要求事务性强一致，恢复时允许回退到 event truth。

### 14.3 幂等

- 命令幂等沿用 core：
  - `submit_signal -> signal_id`
  - `apply_execution_report -> report_id`
  - `capture_authorized_account_snapshot -> snapshot_id`
- 宿主另加：
  - `binding write` 以 `(runtime_id, internal_order_id)` 幂等 upsert
  - `external_submit_order_id` / `external_operate_order_id` 冲突视为严重异常

### 14.4 防重复下单

- effect 执行前，先检查该 `internal_order_id` 是否已有 binding。
- 若存在 binding 且状态不是 terminal，则不重复执行 `submitOrder`。
- 若宿主崩溃发生在“vendor 已下单、binding 未落库”窗口，恢复时必须：
  - 先查 open orders / order history
  - 找不到可归因订单时进入 `audit_only`
  - 不允许盲目重发 `submitOrder`

### 14.5 顺序语义

- 同一 runtime 单线程串行处理命令。
- 同一 `product_id` 首版只允许一个 in-flight external order。
- 同一 runtime 首版只允许一个 canonical subscription。
- 不支持多 worker 并发消费同一个 runtime。

---

## 15. 与现有 vendor / postgres-storage / node-unit 的关系

### 15.1 vendor

- 本 app 通过 `@yuants/exchange` 与现有 vendor 交互。
- 本 RFC 不再在 app 契约里冻结具体 vendor/product 白名单；只要求宿主注入的 live path 能提供稳定的 execution、closed-order history、open orders 与 account snapshot。
- 若某条 venue 只提供 open orders，则可用于 paper/审计，但不纳入可执行 live 支持矩阵。

### 15.2 postgres-storage

- 本 app 假设现有 SQL 服务可用；新增表由 `tools/sql-migration/sql/*.sql` 提供迁移。
- 不要求改 `@yuants/app-postgres-storage` 代码；它继续作为 SQL 服务宿主。

### 15.3 node-unit

- `apps/node-unit/src/index.ts` 已天然信任 `@yuants/*` 包并支持本地 host/pg 附带部署。
- 因此只要：
  - 新增 `@yuants/app-signal-trader` 到 `rush.json`
  - 正常发布/安装
    就可以被 node-unit 部署。
- 本 RFC 不要求 node-unit 新增专门逻辑。

---

## 16. 错误语义与恢复策略

### 16.0 运行状态机（唯一语义）

| 状态         | 进入条件                                                                                                                                                                              | 是否允许继续下单 | 恢复方式                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `stopped`    | runtime disabled；或 boot/preflight 未通过（缺 secret、descriptor 缺失/不匹配/能力不足、live observer/provider 未配置、首次 observe / reconciliation 未获准、账号授权前置校验失败等） | 否               | 修配置/宿主注入后重新 `UpsertRuntimeConfig` / 重新 enable / 重启 worker；`UnlockRuntime` 不适用 |
| `audit_only` | runtime 已进入执行链后发现安全异常：binding 冲突、unknown terminal state、reconciliation mismatch、第二笔 inflight、运行中观测链升级为不可接受等                                      | 否               | operator 先补证据、backfill/确认终态，再执行 `UnlockRuntime`                                    |
| `degraded`   | 只读观测链短时错误（查询超时、单次 observer failure、短时网络抖动）但尚未越过 fail-close 阈值                                                                                         | 否               | 下次 observe 成功且 freshness/reconciliation 恢复后自动回到 `normal`                            |
| `normal`     | boot 校验通过，且当前 reconciliation / observer / binding 健康                                                                                                                        | 是               | 运行态                                                                                          |

冻结规则：

- `UnlockRuntime` 只适用于 `audit_only`。
- `stopped` 不是“人工放行后继续跑”的状态；它表示 runtime 尚未获得 live 准入。
- 所有 live admission failure 一律先进 `stopped`，不要在实现层自由选择 `audit_only`。

### 16.1 不可恢复错误（直接 fail-close）

- live runtime 缺 secret 引用
- secret 解析失败
- runtime config 不满足 live 启动条件
- `authorize_order.account_id` 与 runtime 配置 `account_id` 不一致
- binding 冲突
- unknown external order state 且无法归因
- checkpoint replay 校验失败
- 发现多个同产品未决 external order

### 16.2 可恢复错误（先 degraded，再视阈值升级）

- SQL 查询超时
- QueryPendingOrders 超时
- QueryAccountInfo 超时
- vendor 临时网络错误

### 16.3 重试语义

- 只重试读操作：查询 open orders、查询 SQL 历史、查询账户快照。
- `submitOrder/modifyOrder/cancelOrder` 不做盲重试；必须先检查 binding 与外部观测后再决定。

---

## 17. 可选方案与取舍

### 方案 A：宿主直接同步下单，不落 SQL 事件仓库

- **优点**：实现最快。
- **缺点**：重启不可恢复、无法解释重复/未知订单、无法做 replay 与审计。
- **为什么放弃**：与根 RFC 的事件溯源真源冲突，High risk 场景不可接受。

### 方案 B：只依赖 `GetOrders/GetPositions`，不引入 order binding / SQL history

- **优点**：少建表、少一层映射。
- **缺点**：无法处理 vendor `order_id` 差异；闭合订单终态经常拿不到；重启后极易丢归因。
- **为什么放弃**：live 最核心风险没有被解决，只是把问题推给人工排查。

### 方案 C：修改 `libraries/signal-trader`，让 core 直接支持复杂 live rebasing（未选首版）

- **优点**：理论上可以更早支持多笔同产品并发订单、复杂 modify/cancel rebasing。
- **缺点**：扩大 core 变更面，影响 domain 语义与测试矩阵；当前问题主要是宿主执行边界，而不是 core 事件模型失真。
- **为什么放弃**：首版目标是安全接入 live，不是一次性吃掉复杂并发订单问题。

### 方案 D：SQL 事件仓库 + binding + 串行 live worker（选中）

- **优点**：
  - 与 core RFC 对齐
  - 重启可恢复
  - binding 可吸收 vendor `order_id` 差异
  - 通过串行化规避当前 core live 边界风险
  - 实现面仍在 scope 内
- **缺点**：
  - 吞吐较低
  - live 首版支持矩阵更窄
  - 需要 SQL 订单历史作为观测依赖

### 决策

- 选择：**方案 D**。
- 原因：
  - 满足 High risk 下的可审计、可回滚、可重放；
  - 不修改 node-unit / postgres-storage / vendor 主体；
  - 风险主要通过宿主护栏而不是扩大 core 改动来控制；
  - 与现有 app 模式（trade-copier / virtual-exchange）兼容。
- 放弃了什么：
  - 放弃“所有 vendor 都能 live”的广泛兼容；
  - 放弃多产品/多订单并发吞吐；
  - 放弃在首版就通过 core 补丁解决复杂 rebasing。

---

## 18. Migration / Rollout / Rollback

### 18.1 Migration Plan

- 是否有数据迁移：**有，但仅新增表，不迁移旧业务数据**。
- 步骤：
  1. 新增 5 个 SQL migration 文件。
  2. 新增 `apps/signal-trader` 包并注册到 `rush.json`。
  3. 实现 paper runtime 与本地 README。
  4. 实现 live runtime，但默认只允许 `execution_mode=paper`。
  5. 仅为宿主已完成联调与运维验收的 runtime 写入 `execution_mode=live + observer_backend=<capability-key>`。
- 读写切换策略：
  - 新 app 独立写新表；
  - 不改旧表写入逻辑；
  - `"order"` 表只读；
  - 无双写要求。

### 18.2 Rollout Plan

- feature flags / 配置项：
  - `enabled`
  - `execution_mode`
  - `observer_backend`
- 灰度顺序：
  1. `paper_simulated`
  2. 宿主外 runbook 完成 live 只观测联调（不属于 runtime 状态机）
  3. 宿主已联调通过的 live backend runtime
- 验收指标：
  - event append success rate = 100%
  - replay determinism = 100%
  - binding conflict count = 0
  - unknown terminal state count = 0
  - live runtimes with >1 in-flight order = 0
  - reconciliation mismatch count = 0
  - support matrix 可通过 `SignalTrader/ListLiveCapabilities` 枚举
  - capability descriptor 快照可通过 `signal_trader_runtime_audit_log` 查询到 `descriptor_hash` / `validator_result`

### 18.3 Rollback Plan（可执行）

- 触发器：
  - 出现未知订单终态
  - binding 冲突
  - replay 不一致
  - reconciliation mismatch
  - observer backend 丢失
  - 连续超时超过阈值
- 回滚步骤：
  1. 将对应 runtime `enabled=false`，并保留 checkpoint/health 视图中的 `audit_only` / `lock_reason` 作为排障线索。
  2. 停止产生新 external effect。
  3. operator 人工确认外部订单终态：去 venue / `"order"` 表核实是否仍有在途订单。
  4. 若 binding 缺失但外部订单已知，调用 `SignalTrader/BackfillOrderBinding` 补齐；若 runtime 已不可恢复，则保留旧 runtime 只读并新建 runtime_id，不复用旧 runtime。
  5. 确认“无未知在途订单 + binding 已补齐或明确废弃”后，调用 `SignalTrader/UnlockRuntime` 或 `SignalTrader/ReplayRuntime` 恢复；否则持续锁死。
  6. 必要时删除新 app deployment；不需要回滚 node-unit / vendor / postgres-storage。
- 回滚后数据一致性：
  - event store 保留；
  - binding 保留；
  - checkpoint 可删除重建；
  - 不做历史事件物理回滚。

---

## 19. Observability

### 19.1 Logs

- 每条关键日志必须携带：
  - `runtime_id`
  - `execution_mode`
  - `account_id`
  - `product_id`
  - `signal_id?`
  - `internal_order_id?`
  - `external_submit_order_id?`
  - `external_operate_order_id?`
  - `observer_backend`
  - `health_status`
  - `error_code?`
- 100% 全量记录：
  - fail-close
  - degraded
  - binding 冲突
  - unknown terminal state
  - reconciliation mismatch

### 19.2 Metrics

首版只冻结最小必需指标：

- `signal_trader_runtime_up`
- `signal_trader_runtime_health_status`
- `signal_trader_event_append_total`
- `signal_trader_observer_error_total`
- `signal_trader_binding_conflict_total`
- `signal_trader_unknown_terminal_state_total`
- `signal_trader_inflight_orders`
- `signal_trader_reconciliation_mismatch_total`

### 19.3 Alerts

- 任意 runtime 进入 `audit_only`
- `inflight_orders > 1` for any `(runtime_id, product_id)`
- `unknown_terminal_state_total > 0`
- `binding_conflict_total > 0`
- `reconciliation_mismatch_total > 0`

### 19.4 排障入口

1. `SignalTrader/GetRuntimeHealth`
2. `SignalTrader/QueryEventStream(runtime_id, order_id|signal_id)`
3. SQL 查 `signal_trader_order_binding`
4. SQL 查 `"order"` 历史
5. `SignalTrader/ReplayRuntime`

---

## 20. Security & Privacy

### 20.1 Threat model

- 伪造 signal 导致真实下单
- 利用 secret 引用越权下单
- 通过大量 signal / poll 请求耗尽资源
- 在日志/SQL 中泄露 credential 明文
- 通过错误 binding 把他人订单归因到当前 runtime

### 20.2 权限边界

- `SignalTrader/UpsertRuntimeConfig` 与 `SignalTrader/SubmitSignal` 应分权。
- `SignalTrader/DisableRuntime`、`SignalTrader/ReplayRuntime`、`SignalTrader/BackfillOrderBinding`、`SignalTrader/UnlockRuntime` 只允许 operator/admin 调用，不对普通 signal source 开放。
- live 下单必须经过 `authorize_order`。
- `authorize_order` 返回的 `account_id` 必须与 runtime 配置 `account_id` 严格一致；不一致视为越权或配置漂移，直接 fail-close。
- secret 解析只在 execution adapter 内部发生，不向 query/service 响应暴露原文。

### 20.3 输入校验

- 校验 runtime 配置枚举值与 `execution_mode/backend` 组合。
- 校验 live 必填 `secret_ref`。
- 校验 `SubmitSignal` 的 `runtime_id`、`signal_key`、`product_id` 与 runtime 绑定一致。
- 校验 observer backend 与 live 支持矩阵。

### 20.4 资源耗尽

- runtime 内使用串行队列，限制待处理命令长度。
- poll 间隔有下限。
- 若队列积压或 observer timeout 激增，切 `audit_only`。

### 20.5 Secrets

- `signal_trader_runtime_config` 只存 `secret_ref_kind/value`。
- event payload、metadata、logs 不得写明文 credential。
- 若需要引用 secret，日志仅输出 hash/ref，不输出原文。

---

## 21. 验证计划

### 21.1 Unit tests

- runtime 配置校验：`paper/live` 与 backend 组合是否合法。
- event store 幂等 append。
- order binding upsert 与冲突检测。
- observer normalizer：历史表终态、open orders、unknown 状态判断。
- fail-close 触发条件。

### 21.2 Integration tests

- `paper` 一条 signal 到 filled 全链路。
- runtime 重启后从 checkpoint + event replay 恢复。
- live adapter 在 secret 解析失败时不下单。
- live adapter 在 `external_submit_order_id/external_operate_order_id` 缺失时切 `audit_only`。
- observer 从 `"order"` 表识别 filled/cancelled/rejected。
- open orders 消失但无历史终态时 fail-close。
- 同产品第二笔未决订单出现时 fail-close。
- 生成 `modify_order` effect 时 fail-close。

### 21.3 Regression tests

- 不允许 live 使用 `paper_simulated` 或未被宿主 observer provider 支持的 backend 启动。
- 不允许在 runtime 恢复时重复 submit 同一 internal order。
- 不允许在 binding 缺失时 apply execution report。
- 不允许在 `audit_only` 继续产生 external effect。

### 21.4 Manual validation

- 本地 paper：提交 signal 后检查 event stream、projection、checkpoint。
- audit-only live：只观测不下单，确认可以读取 closed-order history 与账户快照。
- live execution：下一笔最小订单，检查 binding、历史表、event stream 一致。

### 21.5 关键行为与测试映射

- `SubmitSignal -> 事件写入 -> effect 产生`：integration
- `effect 执行 -> binding 落库`：integration
- `binding + order history -> execution report 回灌`：integration
- `重启 -> replay -> 不重复下单`：integration/regression
- `异常观测 -> audit_only`：unit/integration

---

## 22. 首版限制 / 明确 out-of-scope

- live 每个 runtime 仅支持一个 `product_id`。
- live 每个 runtime 仅支持一个 canonical `subscription_id`，且必须等于 `runtime_id`。
- live 每个 `(runtime_id, product_id)` 仅支持一个 in-flight external order。
- 不支持多 worker 并发驱动同一个 runtime。
- 不支持没有 closed-order history 的 venue 进入首版 live。
- 不支持在宿主层做复杂 order rebasing / attribution 重写。
- 不支持 `modify_order` 作为 V1 live 支持路径；出现即 fail-close。
- 不支持对 `libraries/signal-trader` 做大范围 live 并发语义修改。

---

## 23. Milestones（可验收最小增量）

### Milestone 1：建表与 app 骨架

- Scope:
  - 新增 `apps/signal-trader`
  - 新增 4 个 SQL migration
  - Rush 注册
- Acceptance:
  - app 可启动
  - runtime config 可 CRUD
  - event store / checkpoint / binding repository 可读写
- Rollback impact:
  - 仅删除 app deployment 与新表，不影响现有系统

### Milestone 2：paper 闭环

- Scope:
  - runtime worker
  - `SignalTrader/*` 服务
  - paper execution adapter
  - replay/checkpoint
- Acceptance:
  - 一条 signal 能在 paper 完成 event -> effect -> report -> projection 闭环
  - replay determinism = 100%
- Rollback impact:
  - 保留 event store，不影响 live 系统

### Milestone 3：live audit-only 观测

- Scope:
  - secret resolver
  - SQL order history observer
  - account snapshot observer
  - runtime health / metrics
- Acceptance:
  - 不下单即可读取现有 order history / account snapshot，并验证“对已存在 binding 的订单可稳定归因；对无 binding 的历史订单只读不归因”
  - 不满足条件的 runtime 自动拒绝 live
- Rollback impact:
  - 可退回 paper，不影响 core library

### Milestone 4：live 执行收口

- Scope:
  - live execution adapter
  - binding 持久化
  - fail-close / audit_only 策略
- Acceptance:
  - 已联调通过的 live runtime 可完成最小 live 下单并正确回灌
  - unknown terminal state = 0
  - second inflight order detection works
- Rollback impact:
  - runtime 级回滚，直接 disable 即可

---

## 24. Open Questions（仅阻塞级）

- none

---

## 25. Implementation Notes（落地提示）

### 25.1 建议实现顺序

1. 先建表与 repository
2. 再做 runtime manager + services
3. 先打通 paper 闭环
4. 再接 order history observer
5. 最后开 live execution adapter

### 25.2 为什么首版不改 `libraries/signal-trader`

- 当前 live 风险主要在宿主允许多笔未决订单并存，或允许多 subscription 触发 `modify_order` 时，`buildPlannedEffects` 的 keeper/modify/cancel 策略会让 live 归因边界变脆。
- 通过宿主强制 `single_runtime_subscription + single_inflight_order_per_product`，并把 `modify_order` 直接判成 unsupported/fail-close，可以在不改变 core 事件语义和测试矩阵的前提下把风险压到最小。
- 若后续要支持更高吞吐或复杂并发订单，再单开 RFC 评估 core 补丁（例如 order rebasing / attribution refresh）。

### 25.3 需要落地的文件变更点

- `apps/signal-trader/**`：新增 app 包与所有宿主实现
- `tools/sql-migration/sql/signal_trader_*.sql`：新增表
- `rush.json`：注册项目
- `common/config/rush/pnpm-lock.yaml`：依赖变更后更新
- 可选：`libraries/signal-trader/src/index.test.ts` 增加宿主约束相关回归用例

### 25.4 验证步骤清单

- [ ] SQL migration 可重复执行
- [ ] app 启动后可 listWatch runtime config
- [ ] paper runtime 可闭环
- [ ] replay 后 snapshot 与 checkpoint 一致
- [ ] live runtime 在缺少 closed-order history 时拒绝进入可执行态
- [ ] live runtime 在 `external_submit_order_id/external_operate_order_id` 缺失时切 `audit_only`
- [ ] live runtime 检测第二笔未决订单时切 `audit_only`
- [ ] live runtime 生成 `modify_order` effect 时切 `audit_only`
- [ ] `SignalTrader/QueryEventStream` 可追到 signal -> order -> reconciliation 全链路

---

## 26. References

- 任务计划：`.legion/tasks/app-signal-trader-live-integration/plan.md`
- Core domain 真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 相关实现证据：
  - `apps/trade-copier/src/stable.ts`
  - `apps/virtual-exchange/src/credential.ts`
  - `apps/virtual-exchange/src/general.ts`
  - `apps/virtual-exchange/src/legacy-services.ts`
  - `apps/node-unit/src/index.ts`
  - `libraries/signal-trader/src/engine/dispatch-command.ts`
  - `libraries/signal-trader/src/domain/reducer.ts`
  - `libraries/signal-trader/src/ports/execution-port.ts`
  - `libraries/signal-trader/src/ports/mock-execution-port.ts`
  - `tools/sql-migration/sql/order.sql`
  - `tools/sql-migration/sql/secret.sql`
