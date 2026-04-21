# HUOBI IOC/FOK Design

## 背景

Yuan 的 `IOrder.order_type` 已定义 `IOC` 与 `FOK` 语义，但 `apps/vendor-huobi` 当前 `SWAP` 下单只区分 `MARKET` 与其他限价单：普通合约账户在 `submitOrder.ts` 中把非市价单统一映射到 `order_price_type='limit'`，统一账户把非市价单统一映射到 `type='limit'`。这会导致上层传入 `IOrder.order_type = 'IOC' | 'FOK'` 时，Huobi vendor 无法把成交时效透传给交易所。

同时，`apps/vendor-huobi/src/services/orders/listOrders.ts` 虽然已经根据 `order_price_type` 粗略区分 `IOC/FOK`，但这套规则散落在回读逻辑里，没有与提交侧共享，普通合约账户与统一账户的提交规则也没有统一定义。用户已确认本次需求只做 `SWAP`，并要求同时补齐提交与查询回填，形成语义闭环。

## 目标

- 在 `apps/vendor-huobi` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交 `SWAP` 订单。
- 同时覆盖 `SWAP` 的普通合约账户与统一账户下单链路。
- 在 `listSwapOrders` 回读链路中，稳定回填 `IOC | FOK | LIMIT | MARKET`。
- 保持现有 `LIMIT` / `MARKET` 行为不变，改动范围限定在 `apps/vendor-huobi`。

## 非目标

- 不改动 `SUPER-MARGIN` 下单逻辑。
- 不扩展 `MAKER` 语义，也不把 `post_only` 映射升级为 `MAKER`。
- 不改动撤单、改单、成交补录、账户或行情能力。
- 不做跨 vendor 抽象或公共订单映射重构。

## 方案比较

### 方案 A：提取最小共享 helper，再接入 submitOrder 和 listOrders

把 Huobi `SWAP` 的订单类型映射拆成小型纯函数：提交侧分别处理普通合约账户与统一账户的参数映射，回读侧统一根据 `order_price_type` 回填 Yuan `order_type`。

优点：

- 提交与回读规则集中，普通账户和统一账户不会各自漂移。
- 纯函数易于做最小单测，适合按 TDD 小步推进。
- 文件改动仍然很小，能保持本次需求聚焦。

缺点：

- 会多 1-2 个小文件和对应测试。

### 方案 B：只在 submitOrder.ts 和 listOrders.ts 内联改动

直接在现有文件中追加 `IOC/FOK` 分支，不抽 helper。

优点：

- 表面上新增文件更少。

缺点：

- 普通账户、统一账户、回读三处规则继续分散。
- 以后如果再调 `order_price_type` / `time_in_force`，很容易漏改某一条链路。

### 方案 C：只补提交，不补回读

优点：

- 改动最少。

缺点：

- 不满足用户已确认的“提交与查询语义闭环”。

## 最终方案

采用方案 A：提取最小共享 helper，在 `apps/vendor-huobi/src/services/orders/` 内统一管理 `SWAP` 的 `IOC/FOK` 提交与回读映射，再让 `submitOrder.ts` 与 `listOrders.ts` 复用这些规则。

## 影响文件

- `apps/vendor-huobi/src/services/orders/submitOrder.ts`
  - 普通合约账户复用共享 helper 生成 `order_price_type`。
  - 统一账户复用共享 helper 生成 `type` 与 `time_in_force`。
- `apps/vendor-huobi/src/services/orders/listOrders.ts`
  - 不再内联判断 `order_price_type`，改为调用共享回读 helper。
- `apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts`
  - 新增：根据 Yuan `order_type` 分别生成普通合约账户与统一账户需要的下单字段。
- `apps/vendor-huobi/src/services/orders/mapHuobiSwapOrderToOrderType.ts`
  - 新增：根据 Huobi `order_price_type` 回填 Yuan `order_type`。
- `apps/vendor-huobi/src/services/orders/*.test.ts`
  - 新增最小测试，覆盖提交映射与回读映射。
- `docs/zh-Hans/vendor-supporting.md`
  - 同步补充 HTX `SWAP` IOC/FOK 支持说明。

## 详细设计

### 1. 普通合约账户下单映射

`postSwapOrder` 继续使用 `order_price_type` 表示成交时效。本次只做增量扩展：

- `MARKET -> 'market'`
- `LIMIT -> 'limit'`
- `IOC -> 'ioc'`
- `FOK -> 'fok'`

其他字段如 `price`、`volume`、`offset`、`direction`、`lever_rate` 保持现有逻辑不变。`IOC/FOK` 和 `LIMIT` 一样继续走带价格的限价单路径，不借机改动数量或杠杆逻辑。

### 2. 统一账户下单映射

`postUnionAccountSwapOrder` 当前通过 `type` 区分 `market` 与 `limit`，同时 API 已暴露可选 `time_in_force` 字段。本次规则为：

- `MARKET -> type='market'`
- `LIMIT -> type='limit'`
- `IOC -> type='limit', time_in_force='ioc'`
- `FOK -> type='limit', time_in_force='fok'`

这样可以保持现有 `LIMIT` 与 `MARKET` 行为不变，同时把 `IOC/FOK` 明确建模为“带价格的限价单 + 成交时效”。

### 3. 回读映射

`listSwapOrders` 当前读取 Huobi `order_price_type`，本次把它收敛为共享纯函数，规则如下：

- `lightning` 或 `market` -> `MARKET`
- `limit` / `opponent` / `post_only` / `optimal_5` / `optimal_10` / `optimal_20` -> `LIMIT`
- `fok` -> `FOK`
- 包含 `ioc` 的值 -> `IOC`

这里刻意保持 `post_only -> LIMIT`，不扩展成 `MAKER`，因为本次需求没有承诺 `MAKER` 语义闭环，避免把范围扩大成另一轮行为变更。

### 4. 测试策略

遵循 TDD，先写失败测试，再补最小实现：

- 纯映射测试：
  - 普通合约账户 `IOC/FOK` 分别映射到 `ioc/fok`
  - 统一账户 `IOC/FOK` 分别映射到 `type='limit' + time_in_force='ioc'|'fok'`
  - 回读时 `order_price_type='ioc'|'optimal_20_ioc'|'fok'` 能映射回 `IOC|FOK`
- 提交链路测试：
  - 普通合约账户 `submitOrder` 在 `IOC/FOK` 时透传正确 `order_price_type`
  - 统一账户 `submitOrder` 在 `IOC/FOK` 时透传正确 `time_in_force`
  - `MARKET/LIMIT` 既有行为不回归
- 回读链路测试：
  - `listSwapOrders` 返回的 `order_type` 对 `MARKET/LIMIT/IOC/FOK` 映射正确

### 5. 错误处理

- 若调用方传入未知 `order_type`，仍保持显式抛错，避免错误地下发成普通限价单。
- 若 Huobi 返回未知 `order_price_type`，维持当前保守回退行为，不在本次引入新的 vendor 专属枚举。

## 验证策略

- 在新增测试上执行红绿循环，确认每个测试先失败再通过。
- 运行 `rush build -t @yuants/vendor-huobi` 做包级验证。
- 当前 worktree 基线已确认：`rush build -t @yuants/vendor-huobi` 会被仓库现有的 `@yuants/http-services` 集成测试阻塞，错误为 `Host did not start on port 57505 within 10000ms`，与 Huobi IOC/FOK 改动无关；后续验证需继续把它标记为基线问题。

## 提交策略

- 提交 1：新增失败测试与共享映射 helper。
- 提交 2：普通合约账户 `submitOrder` 接入 IOC/FOK。
- 提交 3：统一账户 `submitOrder` + `listOrders` 回读闭环。
- 提交 4：`rush change`、文档同步、验证结果与 PR。

每个提交都保持可独立审阅。
