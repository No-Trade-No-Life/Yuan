# `@yuants/app-signal-trader` 使用与运维指南

> 本文档面向需要**启动、接入、运维、排障** `@yuants/app-signal-trader` 的工程师。
>
> 如果你只想快速跑一个本地 mock 闭环，请先看 [`README.md`](./README.md) 里的“本地 mock bootstrap（推荐）”。
>
> 如果你想统一术语（runtime/profile/health）并查看测试设计意图，请再看 [`doc/concepts-and-test-intent.md`](./doc/concepts-and-test-intent.md)。

---

## 1. 这是什么

`@yuants/app-signal-trader` 是 `@yuants/signal-trader` 的**宿主 app**。

`libraries/signal-trader` 负责：

- domain command / event
- reducer / projection
- planned effects
- event-sourced trading state

`apps/signal-trader` 负责把这些 core 能力变成一个**可运行服务**，补齐：

- runtime 配置管理
- 事件持久化
- checkpoint / restart recover
- paper / live execution adapter
- live order binding
- observer / reconciliation / freshness gate
- Terminal 服务面（`SignalTrader/*`）
- operator 审计与人工接管

一句话说：

> `libraries/signal-trader` 是交易大脑，`apps/signal-trader` 是让它真正落地运行的宿主躯壳。

---

## 2. 它不负责什么

为了避免误解，先讲边界。

本 app **不直接负责**：

- 提供 Host（由 `@yuants/app-host` 负责）
- 提供 SQL 服务（由 `@yuants/app-postgres-storage` 负责）
- 管理真实交易所 SDK / vendor 生命周期（通过 `@yuants/exchange` / 注入的 `liveVenue` 使用）
- 保存明文凭证
- 替代 GUI（GUI 只是它的上层调用方之一）

本 app 只负责把 runtime 的状态机、安全边界与持久化闭环守住。

---

## 3. 运行模式

### 3.1 `paper`

推荐的本地开发模式。

特点：

- 不需要真实凭证
- `observer_backend` 必须是 `paper_simulated`
- `place_order` 会走 paper adapter，本地生成 `accepted -> filled` 回报
- 可完整验证 `event -> effect -> report -> projection` 闭环

适合：

- 本地 smoke
- GUI 联调
- 服务面联调
- event store / replay / checkpoint 验证

### 3.2 `live`

live 不再由 app 内部维护 vendor / product 白名单，而是默认走 **VEX account-bound 服务 + 显式 capability registry**。

当前硬约束：

- `observer_backend` 对 live 必须是宿主约定的任意**非空且不等于** `paper_simulated` 的字符串
- `observer_backend` 同时是 capability descriptor 的 canonical key
- 默认入口已经自动注入：
  - account-bound `liveVenue`（`SubmitOrder` / `CancelOrder`）
  - account-bound `observerProvider`（`QueryPendingOrders` / `QueryAccountInfo` + SQL `"order"` 历史）
  - `liveCapabilityRegistry`（默认 key 为 `vex_account_bound_sql_order_history`）
- 若你自己写宿主，也可以继续显式覆盖 `resolveLiveCredential` / `liveVenue` / `observerProvider` / `liveCapabilityRegistry`
- `liveCapabilityRegistry.resolve(...)` 命中的 descriptor 至少要包含：
  - `key`
  - `supports_submit`
  - `supports_cancel_by_external_operate_order_id`
  - `supports_closed_order_history`
  - `supports_open_orders`
  - `supports_account_snapshot`
  - `supports_authorize_order_account_check`
  - `evidence_source`

不满足条件时，runtime 不会“降级继续下单”，而是直接 fail-close：

- boot / preflight 未通过（缺 registry、descriptor 缺失/不匹配/能力不足、observer provider 未配置、首次 observe 未获准）=> `stopped`
- 运行中已进入执行链后再发现安全异常 => `audit_only`

`upsert` 与 `boot` 两个阶段都会把 capability 校验结果写入 audit log：

- `live_capability_validated`
- `live_capability_rejected`

且 detail 至少包含：`observer_backend`、descriptor 全量布尔位、`evidence_source`、`descriptor_hash`、`validator_result`、`phase`。

---

## 4. 系统拓扑与依赖

最小拓扑如下：

```text
GUI / curl / 外部调用方
          |
          v
      @yuants/app-host
          |
          +---- @yuants/app-postgres-storage ---- PostgreSQL
          |
          +---- @yuants/app-signal-trader
```

### 4.1 paper 最小依赖

至少需要：

1. `@yuants/app-host`
2. `@yuants/app-postgres-storage`
3. PostgreSQL
4. SQL migration
5. `@yuants/app-signal-trader`

### 4.2 live 额外依赖

在 paper 依赖之外，还需要：

- 默认入口内建的 account-bound live 依赖：`SubmitOrder`、`CancelOrder`、`QueryPendingOrders`、`QueryAccountInfo`、SQL `"order"` 历史
- 若要自定义宿主，仍可覆盖 `resolveLiveCredential(runtime)` / `liveVenue` / `observerProvider` / `liveCapabilityRegistry`
- closed order history 来源（默认是 SQL `"order"` 表；自定义宿主也可替换，但要自证）
- 账户快照来源（如 `QueryAccountInfo` / `getPositions`）
- open orders 来源（如 `QueryPendingOrders` / `getOrders`）

### 4.3 默认 CLI 入口的行为

直接运行：

```bash
node apps/signal-trader/lib/index.js
```

会：

- 用 `Terminal.fromNodeEnv()` 建 terminal
- 挂 SQL repositories
- 启动 runtime manager
- 注册 `SignalTrader/*` 服务

默认入口现在会：

- 开启读服务
- 开启写服务
- 开启 operator 服务
- 注入固定的 VEX account-bound live 依赖
- 假设同一 Host 内服务互信

---

## 5. 如何跑起来

### 5.1 最推荐：本地 mock bootstrap

仓库已经提供本地联调脚手架：

- `apps/signal-trader/dev/docker-compose.yml`
- `apps/signal-trader/dev/bootstrap-mock-app.js`
- `apps/signal-trader/dev/run-local-mock-stack.sh`
- `apps/signal-trader/dev/smoke-mock.sh`

最短路径：

```bash
bash apps/signal-trader/dev/run-local-mock-stack.sh start
bash apps/signal-trader/dev/smoke-mock.sh
bash apps/signal-trader/dev/run-local-mock-stack.sh stop
```

这个脚本会自动完成：

1. 启动 postgres 容器
2. 启动 `@yuants/app-host`
3. 启动 `@yuants/app-postgres-storage`
4. 执行 SQL migration
5. 启动一个 **仅限本地调试** 的 permissive `bootstrap-mock-app.js`

### 默认本地端口

- Host HTTP / WS：`127.0.0.1:8888`
- Postgres：`127.0.0.1:54329`
- 默认连接串：`postgres://yuants:yuants@127.0.0.1:54329/yuan`

### 5.2 手工启动

如果你不用 bootstrap 脚本，最小手工步骤是：

1. 启动 Host
2. 启动 Postgres Storage
3. 跑 SQL migration
4. 启动 `app-signal-trader`
5. 如使用默认入口，无需额外配置 `servicePolicy`；如手工嵌入 `createSignalTraderApp(...)`，再按你的场景覆盖它

SQL migration 推荐执行方式：

```bash
HOST_URL="ws://127.0.0.1:8888" node tools/sql-migration/lib/cli.js
```

### 5.3 本地 live bootstrap（前端本地启动）

如果你已经有本地 `ui/web`，并且想把其他 live 依赖一次性拉齐，仓库现在提供了一个 **VEX account-bound 本地 profile**（底层依赖由 `VEX + OKX exchange` 提供；SQL `"order"` 表默认视为外部前提）：

- `apps/signal-trader/dev/docker-compose.live-okx.yml`
- `apps/signal-trader/dev/docker-compose.live-dummy.yml`
- `apps/signal-trader/dev/dummy-live-backend.js`
- `apps/signal-trader/dev/register-vex-credential.js`
- `apps/signal-trader/dev/seed-live-runtime.js`
- `apps/signal-trader/dev/run-local-live-stack.sh`
- `apps/signal-trader/dev/run-local-live-dummy-stack.sh`
- `apps/signal-trader/dev/env.live.example`

这个 profile 的运行形态是：

```text
ui/web (本地 dev server)
          |
          v
      Host (docker)
          |
          +---- postgres-storage (docker) ---- PostgreSQL (docker)
          |
          +---- virtual-exchange (docker)
          |           |
          |           +---- OKX exchange (docker)
          |
          +---- signal-trader default entry (docker)
```

最短路径：

```bash
set -a
source /path/to/live.env
set +a

bash apps/signal-trader/dev/run-local-live-stack.sh start
```

其中：

- `HOST_TOKEN` 是本地 live profile 的最小控制面保护，当前要求显式设置
- `OKX_ACCESS_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE` 供 `VEX/RegisterExchangeCredential` 与 OKX upstream 使用
- `app-signal-trader` 默认入口不再需要额外的 `SIGNAL_TRADER_*` 启动参数；live backend、service policy、SQL `"order"` 表名都已写死在代码里
- SQL `"order"` 表需要由 VEX / 叶子节点 / 外部基础设施维护；默认 compose 不再自带 writer
- `SIGNAL_TRADER_PRODUCT_ID` 只有在 `AUTO_UPSERT_RUNTIME=1` 时才会触发自动 seed；否则脚本只拉起依赖，不自动写 live runtime

注意：

- 这是**本地联调脚手架**，不是生产 compose 模板
- 当前 profile 明确依赖 account-bound Submit/Cancel/Pending/Account 服务与 SQL `"order"` 历史证据链；在本地 compose 里这些 account-bound 服务由 VEX 暴露，但 SQL `"order"` 表的数据生产默认由 VEX / 叶子节点 / 外部基础设施负责，不再由 signal-trader 默认捆绑 writer
- `run-local-live-stack.sh` 会在 compose 里直接启动 `app-signal-trader` 默认入口；默认假设同一 Host 内服务互信，因此读/写/operator 服务全开

### 5.4 生产 / 共享环境启动建议

默认建议是：直接启动 `app-signal-trader` 自带入口，并通过 env 注入 live/paper 所需配置；不要再额外写一层薄宿主当成默认路径。

例如：

```bash
node apps/signal-trader/lib/index.js
```

若你运行在容器/compose 中，就把这些 env 直接注入 `app-signal-trader` 服务本身。只有在你明确要把它嵌进别的宿主进程时，才需要自己调用 `createSignalTraderApp(...)`。

### 5.5 dummy live 测试 compose（不启动 VEX）

如果你只想测 `signal-trader` 是否真的把 submit/cancel/account/pending 请求打出去了，而不想起真实 VEX，可以直接用：

```bash
bash apps/signal-trader/dev/run-local-live-dummy-stack.sh start
```

这条链路里：

- `dummy-live-backend.js` 会模拟 `VEX/ListCredentials`、`SubmitOrder`、`CancelOrder`、`QueryPendingOrders`、`QueryAccountInfo`
- mutating 请求会写入 `${DUMMY_LIVE_OUTPUT_DIR:-/tmp/yuants-signal-trader-dummy-live}/requests.ndjson`
- 同一个 dummy backend 也会把 order history 写进 SQL `"order"`，因此不需要额外 writer 组件
- 这只是测试桩；它的目标是验证请求流，不是模拟真实交易行为

---

## 6. 服务面怎么用

### 6.1 只读服务

- `SignalTrader/ListRuntimeConfig`
- `SignalTrader/ListLiveCapabilities`
- `SignalTrader/QueryProjection`
- `SignalTrader/QueryEventStream`
- `SignalTrader/QueryRuntimeAuditLog`
- `SignalTrader/GetRuntimeHealth`

### 6.2 写服务

- `SignalTrader/UpsertRuntimeConfig`
- `SignalTrader/SubmitSignal`
- `SignalTrader/ReplayRuntime`
- `SignalTrader/DisableRuntime`

### 6.3 operator 服务

- `SignalTrader/BackfillOrderBinding`
- `SignalTrader/UnlockRuntime`

### 6.4 权限模型

- `registerSignalTraderServices()` 这个底层 helper 仍然保持保守：如果你手工传 `servicePolicy`，就按显式策略控制读/写/operator 暴露
- 但 `app-signal-trader` 默认入口已经按当前架构假设收口：同一 Host 内服务互信，所以默认直接开启读/写/operator 全服务
- 默认入口的 operator 审计主体也固定为 host-internal trusted principal，不再通过 env 传入

这意味着：

> 默认入口追求“同一 Host 内开箱即用”；只有你手工嵌入 `createSignalTraderApp(...)` 时，才需要重新关心细粒度权限策略。

### 6.5 最小调用顺序

最常见的 mock 使用顺序：

1. `SignalTrader/UpsertRuntimeConfig`
2. `SignalTrader/SubmitSignal`
3. `SignalTrader/QueryProjection`
4. `SignalTrader/QueryEventStream`
5. `SignalTrader/GetRuntimeHealth`

### 6.6 示例：创建一个 mock runtime

```json
{
  "runtime_id": "runtime-mock",
  "enabled": true,
  "execution_mode": "paper",
  "account_id": "acct-mock",
  "subscription_id": "runtime-mock",
  "investor_id": "investor-mock",
  "signal_key": "sig-mock",
  "product_id": "BTC-USDT",
  "vc_budget": 100,
  "daily_burn_amount": 10,
  "subscription_status": "active",
  "observer_backend": "paper_simulated",
  "poll_interval_ms": 1000,
  "reconciliation_interval_ms": 5000,
  "event_batch_size": 100,
  "metadata": {
    "env": "local"
  }
}
```

### 6.7 示例：提交一个 signal

```json
{
  "runtime_id": "runtime-paper",
  "command": {
    "command_type": "submit_signal",
    "signal_id": "signal-001",
    "signal_key": "sig-paper",
    "product_id": "BTC-USDT",
    "signal": 1,
    "source": "manual",
    "entry_price": 100,
    "stop_loss_price": 90
  }
}
```

---

## 7. 它会产生哪些副作用

这是运维时必须知道的部分。

### 7.1 数据库副作用

本 app 会写入以下表：

- `signal_trader_runtime_config`
- `signal_trader_event`
- `signal_trader_order_binding`
- `signal_trader_runtime_checkpoint`
- `signal_trader_runtime_audit_log`

live 模式还会读取宿主声明在 capability descriptor 里的外部观测链，例如：

- closed order history
- open orders
- account snapshot

这些来源不要求固定落在某一张表，但宿主必须能给出可审计证据（`evidence_source`）。

### 7.2 启动副作用

当一个 `enabled` runtime 被 worker boot 时，可能发生：

1. **自动镜像 canonical subscription**
   - 若当前 runtime 还没有任何事件，worker 会 append 一条 `upsert_subscription` 命令产生的事件
   - 也就是说：`UpsertRuntimeConfig` 不是“只写配置表”，它可能带来 event stream 的初始化
2. **写 checkpoint**
   - boot / replay / observer 后会刷新 checkpoint
3. **live 模式会做初始 observe / reconcile**
   - 如果缺 observer 或首次 freshness / reconcile 不满足，runtime 会停在 `stopped`

### 7.3 提交 signal 的副作用

`SignalTrader/SubmitSignal` 不是纯计算，它可能导致：

- 事件写入 `signal_trader_event`
- paper 模式下自动生成 execution report 并继续回灌事件流
- live 模式下发出真实下单 / 撤单调用
- 创建或更新 `signal_trader_order_binding`
- 刷新 `signal_trader_runtime_checkpoint`
- 在异常场景写 `signal_trader_runtime_audit_log`

### 7.4 observer 的副作用

observer loop 会周期性：

- 读取 binding
- 读取外部订单历史 / open orders / account snapshot
- 将观测结果归一化为 command 回灌 event stream
- 刷新 checkpoint / health
- 在异常时把 runtime 切到 `degraded` 或 `audit_only`

所以它不是“只读线程”，而是会驱动状态推进。

### 7.5 operator 动作的副作用

`BackfillOrderBinding` / `UnlockRuntime` / `DisableRuntime` 都可能：

- 更新 binding 或 checkpoint / health
- 写审计日志
- 改变 runtime 是否允许继续执行
- 默认入口下，operator 身份来自固定的 host-internal trusted principal；若你手工嵌入 `createSignalTraderApp(...)`，仍可改为自定义 `servicePolicy.resolveOperatorAuditContext(...)`

---

## 8. 运行态与运维语义

### 8.1 health 状态

`SignalTraderRuntimeHealth.status` 可能为：

- `normal`：允许正常执行
- `degraded`：观测链暂时异常，不继续产生新 effect，等待恢复
- `audit_only`：已 fail-close，必须人工排查后才能恢复
- `stopped`：未运行 / disabled / boot-preflight 未获准

### 8.2 常见 fail-close 原因

典型 `lock_reason` 包括：

- `LIVE_OBSERVER_PROVIDER_NOT_CONFIGURED`
- `LIVE_OBSERVER_PENDING_INITIAL_RECONCILIATION`
- `AUTHORIZE_ORDER_ACCOUNT_MISMATCH`
- `MISSING_EXTERNAL_ORDER_IDS`
- `MISSING_EXTERNAL_OPERATE_ORDER_ID`
- `MODIFY_ORDER_NOT_SUPPORTED_IN_LIVE_V1`
- `RECONCILIATION_SNAPSHOT_MISSING`
- `RECONCILIATION_SNAPSHOT_STALE`
- `RECONCILIATION_STALE`
- `RECONCILIATION_MISMATCH`

### 8.3 operator 恢复条件

`UnlockRuntime` 不是随便点一下就行，当前实现要求至少满足：

- runtime 当前处于 `audit_only`
- 提供 `operator` / `operator_note` / `evidence`
- binding 不缺失 external ids
- binding 不再处于 in-flight 状态
- live 模式下必须重新 observe，并且 reconciliation 仍是 matched + fresh

### 8.4 排障时先看什么

建议顺序：

1. `SignalTrader/GetRuntimeHealth`
2. `SignalTrader/QueryProjection({ type: 'reconciliation' })`
3. `SignalTrader/QueryEventStream`
4. `signal_trader_order_binding`
5. `signal_trader_runtime_checkpoint`
6. `signal_trader_runtime_audit_log`
7. live 模式下再去看 SQL `"order"` 历史与上游账户快照

---

## 9. 数据建模与为什么要这些表

### 9.1 总原则

这套 SQL 不是为了“多建几张表”，而是为了把不同一致性模型分开：

1. **可变配置**
2. **不可变事件流**
3. **外部订单映射**
4. **可恢复快照 / 运行态**
5. **不可变 operator 审计**

如果把这些硬塞一张表，会让：

- replay 变脆
- live 归因变模糊
- 审计证据被覆盖
- 索引和唯一约束难以表达

### 9.2 必建表

### `signal_trader_runtime_config`

用途：runtime 当前配置源。

为什么单独建表：

- 配置是“当前值”，不是 append-only 历史
- worker 启停、GUI 配置页、批量 list 都要快速读取它

### `signal_trader_event`

用途：runtime 的 append-only 事件仓库，是事实真源。

为什么单独建表：

- replay / projection / query event stream 都靠它
- event payload 保持 core 原样，不做列展开

### `signal_trader_order_binding`

用途：internal order id 与 external order id 的桥梁。

为什么单独建表：

- live cancel / observe 必须用 `external_operate_order_id`
- 需要唯一约束防止错绑单
- backfill / unlock 也依赖它

### `signal_trader_runtime_checkpoint`

用途：存 snapshot + health + freshness 基线。

为什么单独建表：

- 启动恢复不必每次全量 replay
- live 需要持久化最近 account snapshot / matched reconciliation 信息

### `signal_trader_runtime_audit_log`

用途：append-only operator 审计。

为什么单独建表：

- `backfill` / `unlock` / `runtime_locked` 不能只打普通日志
- 需要 runtime 维度可查询、不可覆盖的证据链

### 9.3 live 额外依赖表

### 宿主提供的 closed/open/account 观测来源

这不是 app 固定拥有的表；当前设计只要求宿主能提供：

- closed / filled / cancelled / rejected 终态证据
- open orders 视图
- account snapshot 视图

若 capability descriptor 不能证明这些能力存在，当前 live runtime 不会继续执行，而会停在 fail-close 边界。

### 9.4 为什么不是更少的 2~3 张表

如果目标只是“本地 mock demo”，确实可以更少。

但当前 app 的目标不是只有 demo，还包括：

- replay
- restart recover
- live fail-close
- external id binding
- operator backfill / unlock
- append-only 审计

在这个目标下，当前 5 张表是接近最小可辩护方案。

---

## 10. 需要建立哪些表

### 10.1 signal-trader 自己拥有的表

必须建立：

```text
signal_trader_runtime_config
signal_trader_event
signal_trader_order_binding
signal_trader_runtime_checkpoint
signal_trader_runtime_audit_log
```

### 10.2 migration 工具依赖的表/函数

还会依赖：

- `migration` 表（由 `@yuants/tool-sql-migration` 自动维护）
- `update_updated_at_column()`（来自 `tools/sql-migration/sql/__common.sql`）

### 10.3 live 模式额外建议确认

live 还应确认这些外部依赖已存在并持续有数据：

- `"order"` 表
- 由 VEX / 叶子节点 / 外部基础设施维护的 `"order"` 数据生产者

---

## 11. GUI / 外部系统如何集成

### 11.1 GUI 集成方式

GUI 本质上不需要专门 SDK，只需要能调用 Host 上暴露的 `SignalTrader/*` 服务。

典型流程：

1. GUI 连接 Host 的 WebSocket
2. 查看服务列表
3. 调用 `SignalTrader/ListRuntimeConfig`
4. 调用 `SignalTrader/QueryProjection` / `GetRuntimeHealth` / `QueryRuntimeAuditLog`
5. 如果权限允许，再调用 `UpsertRuntimeConfig` / `SubmitSignal`

### 11.2 GUI 最常用的只读页面

最适合先做的页面：

- runtime 列表
- runtime health 看板
- product projection
- event stream 明细
- reconciliation 视图
- audit log 列表

这些页面几乎都可以只靠：

- `ListRuntimeConfig`
- `GetRuntimeHealth`
- `QueryProjection`
- `QueryEventStream`
- `QueryRuntimeAuditLog`

现在推荐使用独立前端 `ui/signal-trader-web` 作为 signal-trader 控制台入口，而不是再依赖旧的 `ui/web` 页面壳。

注意：audit log 读取建议统一走 `SignalTrader/QueryRuntimeAuditLog`，**不再建议** GUI 复用通用 SQL 直读 `signal_trader_runtime_audit_log`。这样可以把字段白名单、授权与未来脱敏边界都收敛在 signal-trader 服务端。

### 11.3 GUI 调试时的注意事项

- 如果你用的是本地 `bootstrap-mock-app.js`，默认读写/operator 都是开放的，本地最省事
- 如果你手工嵌入了自定义宿主，GUI 才可能遇到 `403`；默认入口已经按“同一 Host 内服务互信”直接放开全部服务
- 若未来要恢复细粒度权限，请在自定义宿主里重新引入 `servicePolicy`，而不是改默认入口

### 11.4 通过 Host `/request` 集成

除了 GUI，也可以直接通过 Host 的 HTTP `/request` 调服务。

示例：

```bash
curl -sS -N \
  -X POST "http://127.0.0.1:8888/request" \
  -H "Content-Type: application/json" \
  --data '{
    "method": "SignalTrader/GetRuntimeHealth",
    "req": { "runtime_id": "runtime-paper" }
  }'
```

如果 Host 开了 `HOST_TOKEN`，就在同一个 `curl` 命令里额外补上：`-H "host_token: <HOST_TOKEN>"`。

---

## 12. 典型使用场景

### 12.1 本地 mock 验证

适合：

- 新 GUI 页联调
- service 契约联调
- replay / query / health 验证

建议直接用：

```bash
bash apps/signal-trader/dev/run-local-mock-stack.sh start
bash apps/signal-trader/dev/smoke-mock.sh
```

### 12.2 共享测试环境

建议：

- 不要直接复用默认入口；它按“同一 Host 内服务互信”直接开放读/写/operator
- 自己写 bootstrap，并显式覆盖 `servicePolicy`
- 至少把写服务和 operator 服务重新收口到 `authorize()`
- 不要复用 permissive 本地脚本

### 12.3 live capability 接入

建议：

- 先用 paper 跑通所有服务面
- 再接 `resolveLiveCredential` / `liveVenue` / `observerProvider` / `liveCapabilityRegistry`
- 最后才让 runtime 切到 `execution_mode=live`

---

## 13. 你最容易踩的坑

1. **直接跑默认入口，却忘了它默认就是全开控制面**
   - 现在默认入口按“同一 Host 内服务互信”直接开放读/写/operator；跨 Host 或共享环境必须自己写 bootstrap 收口权限。
2. **live 没注入 observerProvider，还想进入 normal**
   - 不会；会 fail-close。
3. **把 `subscription_id` 配成不等于 `runtime_id`**
   - 会被拒绝。
4. **paper 模式没用 `paper_simulated` observer**
   - 会被拒绝。
5. **把本地 permissive bootstrap 误当生产配置**
   - 很危险，会暴露高危控制面。
6. **只看 GUI，不看数据库与 audit log**
   - live 问题很多必须联合看 `binding` / `checkpoint` / `audit_log`。

---

## 14. 总结

可以把 `@yuants/app-signal-trader` 理解成一个带运行护栏的 runtime 宿主：

- 对上：暴露 `SignalTrader/*` 给 GUI / 脚本 / 其他系统
- 对内：持有 event store / binding / checkpoint / audit log
- 对外：在 live 模式通过 injected venue / observer 与真实系统交互

如果你只想快速验证，跑 mock bootstrap。
如果你要接 live，请先把 account-bound 路由、observer、SQL `"order"` 证据链与运维 runbook 想清楚；默认入口已经把权限与 live backend 固定好了。
