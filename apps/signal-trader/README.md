# @yuants/app-signal-trader

`@yuants/signal-trader` 的宿主 app，负责 runtime 配置、事件持久化、mock/live 执行编排、binding、checkpoint 与 Terminal 服务面。默认入口支持直接通过 env 启动，不需要额外写薄宿主。

- 想看完整说明（启动方式、运维语义、SQL 建模、GUI 集成、副作用）：请阅读 [`GUIDE.md`](./GUIDE.md)
- 想看概念模型（runtime/profile/health）与测试设计意图：请阅读 [`doc/concepts-and-test-intent.md`](./doc/concepts-and-test-intent.md)

## 本地 mock bootstrap（推荐）

> 这些脚本**只适用于本地调试 / mock E2E**，默认以宽松权限开放读写与 operator 服务，**不能直接用于生产**。

### 目录

- `apps/signal-trader/dev/docker-compose.yml`：本地 postgres
- `apps/signal-trader/dev/bootstrap-mock-app.js`：宽松本地 mock bootstrap app
- `apps/signal-trader/dev/run-local-mock-stack.sh`：一键启动 / 停止本地栈
- `apps/signal-trader/dev/smoke-mock.sh`：最小闭环 smoke
- `apps/signal-trader/dev/docker-compose.live-okx.yml`：本地 live OKX profile 依赖栈（postgres / host / postgres-storage / VEX / OKX exchange；SQL `"order"` history 为外部前提）
- `apps/signal-trader/dev/docker-compose.live-dummy.yml`：本地 dummy live profile（不启动 VEX，改由 dummy backend 直接模拟 account-bound 服务）
- `apps/signal-trader/dev/register-vex-credential.js`：向本地 VEX 注册 account-bound 凭证
- `apps/signal-trader/dev/dummy-live-backend.js`：模拟 `VEX/ListCredentials` / `SubmitOrder` / `CancelOrder` / `QueryPendingOrders` / `QueryAccountInfo`，并把请求写到文件
- `apps/signal-trader/dev/seed-live-runtime.js`：按环境变量自动写入一个 live runtime
- `apps/signal-trader/dev/run-local-live-stack.sh`：一键启动 / 停止本地 live 栈
- `apps/signal-trader/dev/env.live.example`：本地 live 所需环境变量样例

### 默认端口与连接

- Host HTTP / WS：`127.0.0.1:8888`
- Postgres：`127.0.0.1:54329`
- 默认连接串：`postgres://yuants:yuants@127.0.0.1:54329/yuan`
- 默认日志目录：`${TMPDIR:-/tmp}/yuants-signal-trader-mock-stack/logs`

### 最短路径

1. 构建依赖包：

   ```bash
   node common/scripts/install-run-rush.js build \
     -t @yuants/app-host \
     -t @yuants/app-postgres-storage \
     -t @yuants/app-signal-trader \
     -t @yuants/tool-sql-migration
   ```

   也可以直接运行启动脚本；脚本默认会自动补一次 targeted build。若你已提前 build，可加 `SKIP_BUILD=1`。

2. 启动本地 mock 栈：

   ```bash
   bash apps/signal-trader/dev/run-local-mock-stack.sh start
   ```

3. 跑 smoke：

   ```bash
   bash apps/signal-trader/dev/smoke-mock.sh
   ```

4. 停止本地栈：

   ```bash
   bash apps/signal-trader/dev/run-local-mock-stack.sh stop
   ```

### 启动脚本实际做的事

`run-local-mock-stack.sh start` 会按顺序：

1. 启动 `docker-compose` 里的 postgres
2. 启动 `@yuants/app-host`
3. 启动 `@yuants/app-postgres-storage`
4. 执行 `@yuants/tool-sql-migration`
5. 启动 `bootstrap-mock-app.js`，显式开启：
   - `allowAnonymousRead`
   - `enableMutatingServices`
   - `enableOperatorServices`

### smoke 会验证什么

`smoke-mock.sh` 会调用 Host `/request`，顺序执行：

1. `SignalTrader/UpsertRuntimeConfig`（mock）
2. `SignalTrader/SubmitSignal`
3. `SignalTrader/QueryProjection`
4. `SignalTrader/QueryEventStream`
5. `SignalTrader/GetRuntimeHealth`

smoke 不依赖 `jq`；内部使用 Node 解析 NDJSON 响应。

### 可选环境变量

- `HOST_PORT`：默认 `8888`
- `POSTGRES_PORT`：默认 `54329`
- `POSTGRES_DB`：默认 `yuan`
- `POSTGRES_USER` / `POSTGRES_PASSWORD`：默认 `yuants` / `yuants`
- `POSTGRES_URI`：若你想复用外部库，可直接覆盖完整连接串
- `HOST_TOKEN`：若本地 Host 开启了 token，启动脚本 / smoke 会自动透传
- `SKIP_BUILD=1`：跳过启动前 targeted build

## 本地 live bootstrap（OKX local profile）

> 这是**本地联调 profile**：前端仍由你本地启动；脚本会用 docker compose 拉起 Postgres / Host / Postgres Storage / VEX / OKX exchange，`signal-trader` 自身也在同一个 compose 里直接启动。`signal-trader` 仍会读取 SQL `"order"` 表，但这张表的写入责任默认下沉到 VEX / 叶子节点 / 外部基础设施；本 profile 不再捆绑 `okx-order-writer`。它不是生产部署模板。

### 准备环境变量

最少需要：

- Host 控制面保护：`HOST_TOKEN`
- VEX credential register / OKX upstream：`OKX_ACCESS_KEY`、`OKX_SECRET_KEY`、`OKX_PASSPHRASE`
- signal-trader 默认入口本身不再需要额外的 `SIGNAL_TRADER_*` 启动参数；live backend、service policy、SQL `"order"` 表名都已写死在代码里
- SQL `"order"` 表：需要由 VEX / 叶子节点 / 外部基础设施维护，默认 compose 不再自带 writer
- 如果希望启动后自动写入一个可直接在 GUI 中看到的 live runtime，再额外设置：`SIGNAL_TRADER_PRODUCT_ID`

可以先复制一份样例：

```bash
cp apps/signal-trader/dev/env.live.example /tmp/signal-trader-live.env
```

然后把真实值填进去，再执行：

```bash
set -a
source /tmp/signal-trader-live.env
set +a
```

### 启动 / 停止

```bash
bash apps/signal-trader/dev/run-local-live-stack.sh start
bash apps/signal-trader/dev/run-local-live-stack.sh status
bash apps/signal-trader/dev/run-local-live-stack.sh stop
```

或使用 package scripts：

```bash
pnpm --filter @yuants/app-signal-trader run dev:live:start
pnpm --filter @yuants/app-signal-trader run dev:live:stop
```

### 启动脚本实际做的事

`run-local-live-stack.sh start` 会按顺序：

1. targeted build：`app-host` / `app-postgres-storage` / `app-virtual-exchange` / `app-signal-trader` / `vendor-okx` / `tool-sql-migration`
2. 用 `docker-compose.live-okx.yml` 拉起：
   - `postgres`
   - `host`
   - `postgres-storage`
   - `virtual-exchange`
   - `okx-vex-exchange`
   - `signal-trader`
3. 运行 SQL migration
4. 调用 `VEX/RegisterExchangeCredential` 注册本地凭证，让 VEX 暴露 account-bound 服务
5. 通过 compose 启动 `signal-trader` 默认入口容器（env 直接注入 app）
6. 若要让终态观测完整工作，SQL `"order"` 表必须已经由 VEX / 叶子节点 / 外部基础设施持续维护
7. 如果显式设置了 `AUTO_UPSERT_RUNTIME=1` 且给出 `SIGNAL_TRADER_PRODUCT_ID`，脚本会自动执行 `seed-live-runtime.js`

### dummy live compose（不启动 VEX）

如果你只想验证 `signal-trader -> account-bound 服务` 的请求流，而不想起真实 VEX，可以用：

```bash
bash apps/signal-trader/dev/run-local-live-dummy-stack.sh start
bash apps/signal-trader/dev/run-local-live-dummy-stack.sh status
bash apps/signal-trader/dev/run-local-live-dummy-stack.sh stop
```

它会启动：

- `postgres`
- `host`
- `postgres-storage`
- `dummy-live-backend`
- `signal-trader`

说明：

- `dummy-live-backend` 不启动真实 VEX，但会额外暴露一个最小 `VEX/ListCredentials` marker，让当前默认 route proof 逻辑可以通过
- `SubmitOrder` / `CancelOrder` 会把请求写到 `${DUMMY_LIVE_OUTPUT_DIR:-/tmp/yuants-signal-trader-dummy-live}/requests.ndjson`
- dummy backend 也会自己维护 SQL `"order"` 表记录，因此不需要额外的 writer 组件
- 这是测试桩，不是真实交易行为；输出目录里的 `requests.ndjson` / `state.json` 会累积联调数据，必要时请手工清理

### GUI 怎么接

- `ui/web` 继续本地启动即可
- Host 连接地址默认：`ws://127.0.0.1:8888`
- 本地 live profile 默认要求设置 `HOST_TOKEN`
- 启动脚本不会把带 token 的完整 WS URL 打到 stdout；GUI 侧请自己填同一个 `HOST_TOKEN`

### live bootstrap 的约束

- 该 profile 当前收敛为 **VEX account-bound 服务 + SQL `"order"` 历史**；`signal-trader` 继续读取 SQL `"order"` 作为终态证据，但默认交付不再捆绑 writer 进程，表数据需由 VEX / 叶子节点 / 外部基础设施提供
- 新应用已不再使用 `secret_ref`；seed/runtime 只走 VEX account-bound 路径
- `seed-live-runtime.js` 在未显式设置 `SIGNAL_TRADER_ACCOUNT_ID` 时，会尝试从 `QueryPendingOrders` 服务自动发现唯一 trading account_id
- `AUTO_UPSERT_RUNTIME` 默认关闭；为了避免误建 live runtime，只有显式设成 `1` 且给出 `SIGNAL_TRADER_PRODUCT_ID` 时才会自动 seed
- `signal-trader` live 容器日志可通过 `docker compose -f apps/signal-trader/dev/docker-compose.live-okx.yml logs -f signal-trader` 查看

## 最小 mock runbook

1. 启动 `@yuants/app-host`
2. 启动 `@yuants/app-postgres-storage`
3. 执行 `tools/sql-migration/sql/signal_trader_*.sql`
4. 启动本 app：`node apps/signal-trader/lib/index.js`
5. 默认入口会直接注册读/写/operator 全服务；如果你自己手工调用 `createSignalTraderApp(...)`，也可以显式覆盖 `servicePolicy`
6. 通过 `SignalTrader/UpsertRuntimeConfig` 写入：
   - `execution_mode=paper`
   - `observer_backend=paper_simulated`
   - `subscription_id === runtime_id`
7. 调用 `SignalTrader/SubmitSignal`
8. 调用 `SignalTrader/QueryProjection` / `SignalTrader/QueryEventStream` / `SignalTrader/GetRuntimeHealth` 检查闭环

## live 说明

- 默认推荐直接启动 `app-signal-trader` 入口并注入 env，不需要额外写薄宿主
- live 默认走固定的 VEX account-bound 服务，不再依赖 `SIGNAL_TRADER_*` backend env，也不再使用 `secret_ref`
- 默认入口会内建 `vex_account_bound_sql_order_history` capability registry；`observer_backend` 对应固定 backend key，而不是启动时由 env 注入
- `SignalTrader/ListLiveCapabilities` 会返回当前宿主声明的 support matrix，包含 descriptor 原始布尔位、`evidence_source`、稳定 `descriptor_hash`
- 默认入口假设同一 Host 内服务互信：读/写/operator 服务全部开启，并统一使用固定的 host-internal audit principal
- 默认入口会自动注入基于 `SubmitOrder` / `CancelOrder` / `QueryPendingOrders` / `QueryAccountInfo` 的 account-bound live venue 与 observer provider，并默认声明 `vex_account_bound_sql_order_history` capability descriptor；默认会继续读取 SQL `"order"` 作为 closed order history 证据，但不要求由 signal-trader 自己打包 writer 进程
- live runtime 缺少 registry / descriptor / observer provider 时会在 boot/preflight 直接停在 `stopped`
- live capability descriptor 至少需要声明：`supports_submit`、`supports_cancel_by_external_operate_order_id`、`supports_closed_order_history`、`supports_open_orders`、`supports_account_snapshot`、`supports_authorize_order_account_check`，以及 `evidence_source`
- `upsert` 与 `boot` 两个阶段都会把 capability 校验结果写入 `signal_trader_runtime_audit_log`（`live_capability_validated` / `live_capability_rejected`）；detail 至少包含 `phase`、`descriptor_hash`、`validator_result`
- 一旦出现 `modify_order`、账户漂移、缺失 external id、未知订单状态、或订单已离开 `QueryPendingOrders` 但 SQL `"order"` 中没有终态证据，runtime 会直接 fail-close 到 `audit_only`

## 人工接管约束

- `SignalTrader/BackfillOrderBinding` 现在要求：`operator`、`operator_note`、`evidence` 必填。
- backfill 只允许：
  - 补齐缺失的 `external_submit_order_id` / `external_operate_order_id`
  - 或把 binding 状态收敛到 terminal（`filled/cancelled/rejected`）
- `SignalTrader/UnlockRuntime` 前会强制检查：
  - binding 没有缺失 external id
  - binding 不再处于 in-flight 状态
  - live runtime 已做 fresh observe，且 reconciliation 为 matched
- 所有 backfill / unlock / runtime lock/degraded 都会写入 `signal_trader_runtime_audit_log`
