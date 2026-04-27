# Bitget IOC/FOK Design

## 背景

`apps/vendor-bitget` 当前下单链路只显式支持 `LIMIT`、`MARKET`、`MAKER`。在 `submitOrder.ts` 中，Bitget UTA `postPlaceOrder` 的参数映射规则为：`LIMIT -> orderType=limit`，`MARKET -> orderType=market`，`MAKER -> orderType=limit + timeInForce=post_only`。这意味着当上层传入 `IOrder.order_type = 'IOC' | 'FOK'` 时，Bitget vendor 不会按统一语义透传即时成交策略。

同时，`listOrders.ts` 当前直接使用 `v.orderType?.toUpperCase()` 回填 `IOrder.order_type`。对 Bitget 这类把 `IOC/FOK` 表示为 `orderType=limit + timeInForce=ioc|fok` 的接口来说，这会把真实的 IOC/FOK 订单错误回填为 `LIMIT`，导致提交与查询语义不一致。

用户已确认本次目标限定为：

- 支持 Bitget 下单时提交 `IOC/FOK`
- 支持挂单列表回读 `IOC/FOK`
- `MARKET` 保持独立语义，不与 `IOC` 混淆
- 本轮不扩展到 `getOrderDetail`、`modifyOrder` 或其他 vendor

## 目标

- 在 `apps/vendor-bitget` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交订单。
- 在 `listOrders.ts` 中根据 Bitget 返回的 `orderType + timeInForce` 组合回填 `IOrder.order_type = 'IOC' | 'FOK'`。
- 保持现有 `LIMIT`、`MARKET`、`MAKER` 行为不变。
- 采用最小改动，改动范围限定在 `apps/vendor-bitget`。

## 非目标

- 不修改 `getOrderDetail.ts` 的回读映射。
- 不扩展 `modifyOrder` 支持修改订单时效策略。
- 不新增 vendor 专属订单字段。
- 不推动跨 vendor 的统一重构。
- 不改变 `MARKET` 的独立语义，也不把 `MARKET` 与 `IOC` 视为同义词。

## 方案比较

### 方案 A：仅在 `submitOrder.ts` 与 `listOrders.ts` 内联补充分支

直接在两个文件中分别加入 IOC/FOK 的提交与回读判断。

优点：

- 改动文件最少。

缺点：

- `order_type <-> Bitget 参数` 规则分散在两个文件里。
- 后续若补 `getOrderDetail`，容易复制同一套逻辑。

### 方案 B：提取最小共享 helper，再接入提交与回读

将 Bitget 的订单类型映射提取为两个小型纯函数：

- `IOrder.order_type -> { orderType, timeInForce? }`
- `Bitget orderType + timeInForce -> IOrder.order_type`

由 `submitOrder.ts` 和 `listOrders.ts` 共同使用。

优点：

- 规则集中，测试和后续复用更直接。
- 改动仍然很小，但能降低读写链路语义分叉的风险。

缺点：

- 会多出 1-2 个小 helper 文件与对应测试。

### 方案 C：只支持提交，不补回读

优点：

- 实现最快。

缺点：

- 与用户确认的范围冲突。
- Copier / UI / CLI 查询挂单时仍会把 IOC/FOK 错看成 `LIMIT`。

## 最终方案

采用方案 B：提取最小共享 helper，再接入 `submitOrder.ts` 和 `listOrders.ts`。

## 影响文件

- `apps/vendor-bitget/src/services/orders/submitOrder.ts`
  - 改为复用共享的下单映射 helper。
  - 保持现有价格、数量、方向、`posSide` 逻辑不变，只增量支持 `IOC/FOK`。
- `apps/vendor-bitget/src/services/orders/listOrders.ts`
  - 不再直接用 `v.orderType?.toUpperCase()` 回填 `order_type`。
  - 改为优先读取 `timeInForce`，再回退到 `orderType`。
- `apps/vendor-bitget/src/services/orders/mapOrderTypeToBitgetOrderParams.ts`
  - 新增：把 Yuan `order_type` 映射为 Bitget `orderType` / `timeInForce`。
- `apps/vendor-bitget/src/services/orders/mapBitgetOrderToOrderType.ts`
  - 新增：把 Bitget 返回的 `orderType` / `timeInForce` 映射回 Yuan `order_type`。
- `apps/vendor-bitget/src/services/orders/*.test.ts`
  - 新增或扩展最小测试，覆盖提交映射与回读映射。
- `apps/vendor-bitget/SESSION_NOTES.md`
  - 记录本轮设计落地、验证结果与后续边界。

## 详细设计

### 1. 提交侧映射

本次不改 `submitOrder.ts` 对 futures / spot 的主体分支，也不改数量与价格的既有处理方式。只把 `order_type` 到 Bitget 下单参数的映射集中起来：

- `MARKET -> { orderType: 'market' }`
- `LIMIT -> { orderType: 'limit' }`
- `MAKER -> { orderType: 'limit', timeInForce: 'post_only' }`
- `IOC -> { orderType: 'limit', timeInForce: 'ioc' }`
- `FOK -> { orderType: 'limit', timeInForce: 'fok' }`

这样可以保持已确认的约束：`MARKET` 仍然是独立类型，不会因为 Bitget 的时效参数模型而被并入 `IOC`。

对 spot 与 futures 来说，IOC/FOK 都继续走“有价格的 limit 单”语义；本次不会为它们引入额外的 price/qty 特判，更不会改动 `MARKET` 现有逻辑。

### 2. 回读侧映射

Bitget UTA 的 open orders payload 同时包含：

- `orderType`，通常为 `market` 或 `limit`
- `timeInForce`，对于时效策略可能为 `post_only` / `ioc` / `fok`

由于 `IOC/FOK` 往往仍以 `orderType=limit` 表示，不能再用 `orderType.toUpperCase()` 直接回填。新的回读规则为：

- `timeInForce = 'post_only'` -> `MAKER`
- `timeInForce = 'ioc'` -> `IOC`
- `timeInForce = 'fok'` -> `FOK`
- 否则，`orderType = 'market'` -> `MARKET`
- 否则，`orderType = 'limit'` -> `LIMIT`
- 其他未知组合 -> `UNKNOWN`

这里故意优先判定 `timeInForce`，因为它携带的是更具体的成交时效语义；只有当 `timeInForce` 没有明确表达特殊策略时，才回退到 `orderType`。

### 3. `MARKET` 与 `IOC` 的语义边界

用户已明确要求保持 `MARKET` 独立，因此本次不会借机引入任何“把部分 Bitget 市价单读成 IOC”的推断逻辑。

实现上遵守两条规则：

- 只有显式 `timeInForce='ioc'` 时才回填 `IOC`
- 只有显式 `orderType='market'` 且不存在更具体的 `timeInForce` 映射时才回填 `MARKET`

这样可以避免把平台原生市价单和带价格约束的 IOC 限价单混在一起。

### 4. 测试策略

遵循 TDD，先补失败测试，再做最小实现。

纯映射测试：

- `MARKET -> { orderType: 'market' }`
- `LIMIT -> { orderType: 'limit' }`
- `MAKER -> { orderType: 'limit', timeInForce: 'post_only' }`
- `IOC -> { orderType: 'limit', timeInForce: 'ioc' }`
- `FOK -> { orderType: 'limit', timeInForce: 'fok' }`
- 未知 `order_type` 抛错

回读映射测试：

- `timeInForce='post_only' -> MAKER`
- `timeInForce='ioc' -> IOC`
- `timeInForce='fok' -> FOK`
- `orderType='market' -> MARKET`
- `orderType='limit' -> LIMIT`
- 未知组合 -> `UNKNOWN`

最小集成测试：

- `submitOrder` 提交 `IOC/FOK` 时，传给 `postPlaceOrder` 的参数包含正确的 `orderType/timeInForce`
- `listOrders` 在收到 `timeInForce=ioc|fok|post_only` 的 payload 时回填正确 `order_type`

本次不搭更大的 E2E 基建，只锁住订单类型映射语义，避免为了一个小能力引入额外脚手架。

## 错误处理

- 若调用方传入未知 `order_type`，继续显式抛错，避免悄悄降级成错误的 Bitget 参数。
- 若 Bitget 返回未知 `orderType/timeInForce` 组合，回填 `UNKNOWN`，不做激进猜测。

## 验证策略

- 运行新增测试，确认红绿循环成立。
- 运行 `npx tsc --noEmit --project apps/vendor-bitget/tsconfig.json` 做最低静态检查。
- 视仓库现状运行包级构建或等价验证；若被与本改动无关的基线问题阻塞，需要在结果中明确说明。

## 提交策略

- 提交 1：测试与共享映射 helper。
- 提交 2：`submitOrder` 接入 IOC/FOK。
- 提交 3：`listOrders` 回读映射与文档更新。
- 提交 4：验证、`rush change`、PR 整理。

每个提交保持自洽，可单独审阅。
