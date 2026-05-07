# RFC: signal-trader mock 账户最小闭环与前端展示

## 背景与目标

当前 `apps/signal-trader/src/execution/paper-execution-adapter.ts` 会把 mock 成交价固定写成 `1`，并且只回报执行状态，不维护 `IAccountInfo`。这导致 mock 路径虽然能驱动 signal-trader 的事件与 effect 闭环，但无法验证真实盈亏，也无法把 mock 账户状态投喂给前端。

本任务要交付一个 mock-only 的最小闭环：

- 成交价可控，优先按提交信号时的 `entry_price` 成交
- paper adapter 在 app 层维护最小 `IAccountInfo` 账本
- 主前端复用标准 `QueryAccountInfo` / `AccountInfo` 生态读取 mock 账户
- 独立前端补一个 mock account card

该能力只服务本地联调，不升级为 `libraries/signal-trader` 的 domain 真相。

## 非目标

- 不改 live observer、live account snapshot、reconciliation 协议
- 不新增 SQL schema，不做 mock 账户跨进程持久化
- 不修改 `libraries/signal-trader` 的 `PlannedEffect` 或 event/reducer 契约
- 不实现完整保证金、多币种结算、手续费、逐笔撮合模型
- 不为 `ui/web` 新建 signal-trader 专用页面

## 关键定义

- `allocation balance`: `queryTradingBalance` 返回的 trading allocation 余额，只服务于 paper transfer / daily allocation
- `mock account_id`: 由 runtime 派生的唯一 mock 账户 ID，格式建议为 `encodePath('signal-trader-mock', runtime_id, runtime.account_id)`
- `mock account balance`: mock 账户余额，表示“已分配本金 + 已实现盈亏 - 已允许转出的 mock 资金”
- `mock account equity`: `balance + floating_profit`
- `mock fill context`: 仅供 paper adapter 使用的最小定价输入 `{ signal_id, product_id, entry_price?, reference_price? }`

## 现状问题

1. mock fill price 硬编码为 `1`，无法验证 10 买、20 卖这类盈亏链路
2. paper 路径没有持仓/账户账本，前端只能看到 capital/runtime，不能看到真实 mock 账户变化
3. 标准 `QueryAccountInfo` / `AccountInfo` 生态已存在，但 signal-trader mock 路径没有接入
4. `queryTradingBalance` 已承载 allocation 语义，不能直接拿来冒充 mock account equity，否则会破坏 daily allocation 行为

## 设计总览

### 1. 账本边界

在 app 层为 `PaperExecutionAdapter` 维护两套彼此解耦的状态：

1. `PaperTransferState`：按 `runtime_id` 维护 allocation 余额，继续服务 `queryTradingBalance` / `submitTransfer`
2. `PaperMockAccountState`：按 `runtime_id` 维护 mock 账户账本，但对外只暴露唯一的 `mock account_id`

二者关系：

- transfer-in 同时增加 allocation balance 与 mock balance
- transfer-out 同时减少 allocation balance 与 mock balance，但实际扣减金额要做 `free` 保护
- 交易盈亏只改变 mock balance / equity，不回写 allocation balance

因此，mock 平仓盈利不会改变 `queryTradingBalance` 的预算语义，也不会因为盈利直接触发 allocation sweep 误判。

### 2. mock 账户主键

对外发布标准账户流时，不直接复用 runtime 原始 `account_id`，而是使用 runtime 派生的唯一 `mock account_id`。

原因：

- 避免多个 paper runtime 复用同一原始 `account_id` 时发生串线
- 允许内部继续以 `runtime_id` 管理状态，而标准账户生态只消费唯一 account key
- 主前端 `AccountInfo` 生态天然就是按 `account_id` 消费，这样最稳

实现约束：

- `SignalTrader/GetMockAccountInfo(runtime_id)` 返回的 `IAccountInfo.account_id` 必须是派生后的 `mock account_id`
- `QueryAccountInfo(account_id)` 只接受派生后的 `mock account_id`
- 独立前端同时展示原始 `runtime.account_id` 与派生后的 `mock account_id`

### 3. 成交价来源

不改 `PlannedEffect`，也不扩展共享 `ExecutionAdapter` 契约。

改为在 `RuntimeWorker.submitSignal` 中、`executeEffects` 之前，把 paper-only 的最小定价上下文写入 `PaperExecutionAdapter`：

```ts
paperAdapter.setMockFillContext(runtime, {
  signal_id,
  product_id,
  entry_price,
  reference_price,
});
```

`PaperExecutionAdapter.execute()` 只在处理当前 `signal_id + product_id` 的 `place_order` 时消费这份上下文；用完即清除。

fill price 优先级：

1. 有效的 `entry_price`
2. 有效的 `reference_price`
3. 最近一次有效成交价或当前持仓价
4. 常量 `1`

若走到 fallback `1`，必须留下最小可观测证据（至少 debug/audit note）。

### 4. mock 账本模型

建议新增 `apps/signal-trader/src/execution/paper-account-ledger.ts`，把记账逻辑从 adapter 中拆出来。

最小状态：

```ts
type PaperMockAccountState = {
  runtime_id: string;
  mock_account_id: string;
  currency: string;
  leverage: number;
  balance: number;
  positions: Map<string, PaperMockPositionState>;
  last_prices: Map<string, number>;
  updated_at: number;
};
```

position 至少包含：`product_id`、`direction`、`volume`、`free_volume`、`position_price`、`current_price`、`floating_profit`、`valuation`、`updated_at`。

记账规则：

- 开仓：只更新持仓均价/数量，不改 `balance`
- 平仓：把已实现盈亏计入 `balance`
- `profit = sum(floating_profit)`
- `equity = balance + profit`
- `used = sum(abs(position.volume * position.current_price))`
- `free = equity - used`

`used` 首版固定使用“绝对估值”公式，不再摇摆；后续若要改，必须单独开任务。

### 5. transfer 与 mock money 的最小边界

为避免自动 sweep 把 mock `free` 扣成负数，transfer-out 采用保守规则：

```ts
actual_transfer_out = min(requested_amount, max(money.free, 0));
```

语义：

- transfer-in：始终增加 allocation + mock `balance`
- transfer-out：只允许扣减可用 `free`
- 若被 clamp，transfer 仍按实际金额完成；后续周期可继续尝试剩余部分

这不是完整保证金模型，但足以保证 mock `IAccountInfo` 不出现明显自相矛盾的负 `free`。

### 6. 标准账户发布生命周期

由 app 启动层维护单一 `paper account publisher registry`，不要让 worker 自己直接注册或销毁服务。

registry 负责：

- 以 `mock account_id` 为 key 注册 `QueryAccountInfo`
- 为同一 key 发布 `AccountInfo` channel
- 把 `PaperExecutionAdapter` 的账户更新桥接到 `publishAccountInfo`
- 在 runtime upsert / disable / app restart 时统一刷新和清理注册项

最小 wiring：

1. `createSignalTraderApp.start()` 完成 `runtimeManager.start()` 后，调用 `registry.sync()`
2. 包装 `upsertRuntimeConfig` / `disableRuntime` handler，在 runtime 变化后再次 `registry.sync()`
3. `registry.sync()` 必须按“当前启用的 paper runtime”做全量对账：新增缺失注册、刷新仍有效注册、删除陈旧注册，禁止实现成只增不减
4. process restart 后重新建 registry；mock account 重置为空快照视为预期行为
5. `replayRuntime` 只复用既有 `mock account_id` 并重新推送快照，不新增 registry key

### 7. 独立前端

独立前端不直接走 `QueryAccountInfo(account_id)`，而是走 signal-trader 自己的读服务：

- `SignalTrader/GetMockAccountInfo({ runtime_id }) -> IAccountInfo`

原因：

- runtime rail 已天然以 `runtime_id` 组织
- UI 不需要提前知道派生出来的 `mock account_id`
- 返回值仍然是标准 `IAccountInfo`，不会形成第二套账户数据模型

页面行为：

- 仅在 `paper + paper_simulated` runtime 下显示 mock account card
- 只做查询 + 既有轮询刷新，不新增 `AccountInfo` 实时订阅链路
- 展示 `balance / equity / profit / free / used / updated_at`
- 展示 positions table：`product_id / direction / volume / position_price / current_price / floating_profit`
- 同时展示原始 `runtime.account_id` 与派生 `mock account_id`
- 查询失败只影响该卡片，不影响 capital/runtime/audit 视图

## 接口设计

### app 内部

- `PaperExecutionAdapter.setMockFillContext(runtime, context)`
- `PaperExecutionAdapter.getMockAccountInfo(runtime)`
- `PaperExecutionAdapter.subscribeMockAccountInfo(runtime, handler)`

### 对外服务

- `SignalTrader/GetMockAccountInfo`
  - 入参：`{ runtime_id: string }`
  - 出参：`IAccountInfo`
- `QueryAccountInfo`
  - 入参：`{ account_id: mock_account_id, force_update?: boolean }`
  - 出参：`IAccountInfo`
- `AccountInfo` channel
  - key：`mock_account_id`
  - payload：`IAccountInfo`

兼容性：

- 不改 live 的 `QueryAccountInfo` 证明链路
- 不改 `SignalTrader/*` 现有写服务
- 不改 `queryTradingBalance` 返回结构

## 失败与回滚语义

- 无有效价格时允许 fallback 到 `1`，但要留可观测证据，不锁 runtime；最小字段集固定为 `runtime_id`、`signal_id`、`product_id`、`entry_price`、`reference_price`、`resolved_fill_price`、`fill_price_source`
- mock 账户不存在时返回空账户快照，不返回 500
- app restart 后 mock 账本重置为预期行为；通过 RFC/文档明确说明
- 回滚时只需去掉 paper ledger、publisher registry、`SignalTrader/GetMockAccountInfo` 与独立前端卡片

## 风险与缓解

1. 多 runtime 串线
   - 用派生 `mock account_id` 彻底切断与原始 `account_id` 的冲突
2. transfer 与账本语义打架
   - transfer-out 对 mock money 做 `free` clamp
3. paper-only 语义扩散
   - 不改 `PlannedEffect`，不改共享 `ExecutionAdapter`，只加 paper adapter 专用 helper
4. 服务生命周期失控
   - 统一由 app 启动层 registry 管理注册/更新/回收

## 验证计划

1. 任意成交价
   - `entry_price=10` 开仓、`entry_price=20` 平仓后，`balance/equity` 增加 `10`
2. fallback 链路
   - 无 `entry_price` 时优先用 `reference_price`，再用最近价，最后 fallback `1`
3. 账户语义
   - 开仓不改 `balance`，平仓才结转 realized PnL；`profit/equity/free/used` 随持仓变化更新
4. allocation 不回归
   - `queryTradingBalance` 继续满足现有 daily allocation / transfer 测试
5. 标准账户输出
   - `SignalTrader/GetMockAccountInfo(runtime_id)` 与 `QueryAccountInfo(mock_account_id)` 都返回合法 `IAccountInfo`
6. 生命周期
   - runtime upsert / disable 后 publisher registry 没有残留旧服务；多 runtime 不串线
7. 独立前端
   - mock runtime 下能看到 account card；提交 10 买、20 卖后，卡片数字发生预期变化

## 涉及文件

- `apps/signal-trader/src/execution/paper-execution-adapter.ts`
- `apps/signal-trader/src/execution/paper-account-ledger.ts`（新增）
- `apps/signal-trader/src/runtime/runtime-worker.ts`
- `apps/signal-trader/src/runtime/runtime-manager.ts`
- `apps/signal-trader/src/services/paper-account-publisher-registry.ts`（新增）
- `apps/signal-trader/src/services/signal-trader-services.ts`
- `apps/signal-trader/src/app.ts`
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
- `ui/signal-trader-web/src/api.ts`
- `ui/signal-trader-web/src/types.ts`
- `ui/signal-trader-web/src/app.tsx`
- `ui/signal-trader-web/tests/signal-trader.spec.ts`

## 执行顺序

1. 先实现 `paper-account-ledger.ts`，打通 10 买 / 20 卖的单测
2. 在 `RuntimeWorker` 写入最小 mock fill context，不扩散到共享执行接口
3. 在 `PaperExecutionAdapter` 接入 ledger 与标准 `IAccountInfo` 导出
4. 增加 app 启动层 publisher registry 与 `SignalTrader/GetMockAccountInfo`
5. 更新独立前端 card 与 Playwright mock 冒烟
