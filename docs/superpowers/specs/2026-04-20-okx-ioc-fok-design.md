# OKX IOC/FOK Design

## 背景

Yuan 的 `IOrder.order_type` 已在共享类型注释中定义 `IOC` 与 `FOK` 语义，但 `apps/vendor-okx` 当前只支持 `LIMIT`、`MARKET` 和 `MAKER`。这导致通过 OKX vendor 提交 `IOC` / `FOK` 订单会在本地映射阶段失败，同时从 OKX 拉回的订单若 `ordType` 为 `ioc` / `fok`，也会被回填成 `UNKNOWN`，造成提交与查询语义不一致。

本次改动只推进 OKX vendor，对外统一使用 `IOrder.order_type = 'IOC' | 'FOK'`，不引入 vendor 专属字段，也不顺手扩散到其他交易所。

## 目标

- 在 `apps/vendor-okx` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交订单。
- 在 OKX 订单查询链路中，将 `ordType = 'ioc' | 'fok'` 映射回 `IOrder.order_type = 'IOC' | 'FOK'`。
- 保持现有 `LIMIT` / `MARKET` / `MAKER` 行为不变。
- 采用最小改动，避免扩大到跨 vendor 的统一重构。

## 非目标

- 不修改其他 vendor 的下单或订单查询逻辑。
- 不新增 `IOrder` vendor 特定字段。
- 不为 OKX 改单接口新增 `ordType` 修改能力。
- 不改动与 IOC/FOK 无关的订单状态、数量换算和持仓方向逻辑。

## 方案比较

### 方案 A：仅在 vendor-okx 内补齐 IOC/FOK 映射

直接扩展 OKX vendor 的下单映射与回读映射，使 `IOrder.order_type` 与 OKX `ordType` 双向一致。

优点：

- 改动范围最小。
- 与用户确认的“直接扩展 `order_type`”方向一致。
- 风险集中在 OKX vendor，易于验证与回滚。

缺点：

- 其他 vendor 仍不会自动支持 `IOC` / `FOK`。

### 方案 B：同步推进共享层与多个 vendor 对齐

在共享层明确平台级能力，同时把多个 vendor 一起补齐。

优点：

- 长期语义更统一。

缺点：

- 范围明显超出“推进 OKX”目标。
- 评审、测试与回归成本更高。

### 方案 C：新增 OKX 专属字段承载时效策略

保留 `order_type` 原样，额外引入 vendor 字段映射到 OKX 的 `ordType=ioc/fok`。

优点：

- 避免触碰现有通用语义。

缺点：

- 与用户确认方向冲突。
- 平台接口会被切碎，后续调用方更难理解。

## 最终方案

采用方案 A，只在 `apps/vendor-okx` 内补齐 `IOC/FOK` 双向映射。

## 影响文件

- `apps/vendor-okx/src/orders/submitOrder.ts`
  - 扩展 `mapOrderTypeToOrdType`，增加 `IOC -> ioc`、`FOK -> fok`。
  - 保持数量换算、`tgtCcy`、`reduceOnly`、价格字段逻辑不变。
- `apps/vendor-okx/src/orders/listOrders.ts`
  - 扩展 `x.ordType -> order_type` 映射，增加 `ioc -> IOC`、`fok -> FOK`、`post_only -> MAKER`。
- `apps/vendor-okx/src/order.ts`
  - 扩展历史/未成交订单回读的 `ordType -> order_type` 映射，保证写库链路与查询链路一致。
- `apps/vendor-okx/src/experimental/getOrders.ts`
  - 扩展实验接口中的订单类型回读映射，避免出现语义分叉。
- `apps/vendor-okx/src/orders/modifyOrder.ts`
  - 不改动逻辑，只确认本次不处理 `ordType` 修改。
- `apps/vendor-okx/src/**/*.test.ts`（新增最小测试文件）
  - 为新增映射补充测试，优先测试纯映射函数，避免引入复杂集成依赖。

## 详细设计

### 1. 下单映射

OKX 下单接口 `postTradeOrder` 已接受自由字符串 `ordType`，因此无需修改 API 类型定义。`submitOrder.ts` 当前的失败点是本地 `mapOrderTypeToOrdType` 只识别三种类型。本次仅扩展该映射表：

- `LIMIT -> limit`
- `MARKET -> market`
- `MAKER -> post_only`
- `IOC -> ioc`
- `FOK -> fok`

订单数量计算继续沿用现有逻辑：

- `SPOT` 直接使用 `order.volume`
- `MARGIN` 保持现有 `LIMIT` / `MAKER` / `MARKET` 处理方式
- `SWAP` 维持原实现

其中 `IOC/FOK` 不额外引入新的数量分支，原因是它们属于成交时效策略，而不是数量单位策略。本次不借机重写数量换算逻辑。

### 2. 回读映射

当前 `listOrders.ts`、`order.ts`、`experimental/getOrders.ts` 都把 `ordType` 只映射为 `MARKET` / `LIMIT` / `UNKNOWN`，且遗漏了现有已支持的 `post_only -> MAKER`。本次会统一补齐回读映射：

- `market -> MARKET`
- `limit -> LIMIT`
- `post_only -> MAKER`
- `ioc -> IOC`
- `fok -> FOK`
- 其他未知值仍为 `UNKNOWN`

为了避免三个文件重复维护一份脆弱的三元表达式，实现阶段优先把该映射提取到 `apps/vendor-okx/src/orders/mapOkxOrdTypeToOrderType.ts` 之类的小文件中复用。这样改动仍然很小，但能降低后续漏改风险。

### 3. 改单边界

`modifyOrder.ts` 当前只支持修改价格和数量，没有改 `ordType` 的能力。OKX 的 amend 接口本身也不以“修改订单时效类型”为主要用途。本次明确不扩展这一能力，避免把需求从“支持 IOC/FOK 下单”膨胀成“支持订单策略重写”。

### 4. 测试策略

遵循 TDD，优先给纯映射逻辑补最小测试：

- 一个测试覆盖 `IOC/FOK` 的下单映射。
- 一个测试覆盖 `market/limit/post_only/ioc/fok` 的回读映射。
- 一个测试覆盖未知值保持 `UNKNOWN`，防止未来误映射。

由于 `vendor-okx` 当前几乎没有现成测试基础，本次不搭建复杂集成测试环境，避免为一个小能力引入过多脚手架。测试目标是锁定映射语义，确保实现改动有回归保护。

## 错误处理

- 若调用方传入未知 `order_type`，仍保持显式抛错，避免悄悄降级成错误的 OKX `ordType`。
- 若 OKX 返回未知 `ordType`，仍映射为 `UNKNOWN`，避免错误猜测。

## 验证策略

- 运行新增测试，确认先失败再通过。
- 运行 `rush build -t @yuants/vendor-okx` 做包级验证。
- 如果再次被仓库现有的 `@yuants/http-services` 集成测试阻塞，在结果中明确说明这是基线已知问题，而非本次改动引入。

## 提交策略

- 提交 1：补测试和共享映射函数。
- 提交 2：接入 `submitOrder` 与订单回读链路。
- 提交 3：补 `rush change`、整理验证结果。

每个提交都保持自洽，可单独审阅。
