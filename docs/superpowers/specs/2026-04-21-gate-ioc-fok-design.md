# Gate IOC/FOK Design

## 背景

`apps/vendor-gate` 当前永续下单仅支持 `LIMIT`、`MARKET`、`MAKER`。在 `submitOrder.ts` 中，`resolveTif` 只会把 `MARKET` 映射为 `ioc`，把 `LIMIT` / `MAKER` 映射为 `gtc`。这意味着当上层传入 `IOrder.order_type = 'IOC' | 'FOK'` 时，Gate vendor 会直接抛出 `Unsupported order_type`。

同时，`listOrders.ts` 当前返回的 `IOrder` 对象没有 `order_type` 字段，因此无法把 Gate 订单的 `tif` 回填为 Yuan 侧统一的 `order_type` 语义。用户已确认本次需求要在 Gate vendor 内实现双向一致：提交支持 `IOC/FOK`，查询也要回填 `IOC/FOK`。

## 目标

- 在 `apps/vendor-gate` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交 Gate 永续订单。
- 保持 `resolveTif` 对现有 `MARKET`、`LIMIT`、`MAKER` 的行为完全不变，只增量增加 `IOC -> ioc`、`FOK -> fok`。
- 在 `listOrders.ts` 中新增 `order_type` 字段，并按 `tif + price` 的组合规则回填 `MARKET` / `IOC` / `FOK` / 现有类型。
- 保持改动范围限定在 `apps/vendor-gate`，避免扩散到其他 vendor。

## 非目标

- 不修改 Gate 的现货或 unified 下单逻辑。
- 不新增 vendor 专属订单字段。
- 不顺手扩展 `ModifyOrder`、更多订单状态映射或其他账户类型。
- 不改动 `MARKET`、`LIMIT`、`MAKER` 既有行为。

## 方案比较

### 方案 A：仅修改 submitOrder 和 listOrders

直接在两个文件里内联新增映射与推断逻辑。

优点：

- 改动文件最少。

缺点：

- `tif <-> order_type` 规则会散落在两个文件里。
- 后续若再有别的读取入口，需要重复维护同一套规则。

### 方案 B：提取最小共享 helper，再接入 submitOrder 和 listOrders

将 Gate 的 `order_type -> tif` 与 `tif + price -> order_type` 提取为小型纯函数，由 `submitOrder.ts` 和 `listOrders.ts` 共用。

优点：

- 把订单类型映射规则集中到一处，测试更直接。
- 改动仍然很小，但能降低未来漏改风险。

缺点：

- 比方案 A 多引入 1-2 个小文件。

### 方案 C：仅支持提交，不补查询回填

优点：

- 改动最少。

缺点：

- 与用户确认的“双向一致”冲突。

## 最终方案

采用方案 B：提取最小共享 helper，再接入 `submitOrder.ts` 和 `listOrders.ts`。

## 影响文件

- `apps/vendor-gate/src/services/orders/submitOrder.ts`
  - 复用共享 `resolveTif` / 等价 helper。
  - 保持 `MARKET`、`LIMIT`、`MAKER` 行为不变，只增量支持 `IOC`、`FOK`。
- `apps/vendor-gate/src/services/orders/listOrders.ts`
  - 新增 `order_type` 字段。
  - 通过 `tif + price` 回填 `order_type`，避免把 Gate 的市价单误判成 `IOC`。
- `apps/vendor-gate/src/services/orders/mapOrderTypeToTif.ts`
  - 新增：`IOrder.order_type -> Gate tif` 纯映射。
- `apps/vendor-gate/src/services/orders/mapGateOrderToOrderType.ts`
  - 新增：根据 Gate 订单的 `tif` 与 `price` 推断 Yuan 的 `order_type`。
- `apps/vendor-gate/src/services/orders/*.test.ts`
  - 新增或扩展测试，覆盖纯映射与最小集成行为。
- `apps/vendor-gate/SESSION_NOTES.md`
  - 记录本轮决策、验证结果与后续风险。

## 详细设计

### 1. 提交侧：order_type -> tif

保持 `submitOrder.ts` 现有价格逻辑不变：

- `MARKET` 继续使用 `price = '0'`
- 其他有价单继续要求 `price`

`resolveTif` 的语义只做增量扩展：

- `MARKET -> ioc`
- `LIMIT -> gtc`
- `MAKER -> gtc`
- `IOC -> ioc`
- `FOK -> fok`

这里的关键约束是：不能改变 `MARKET` 和 `LIMIT/MAKER` 已有行为。也就是说，本次不会把 `LIMIT` 或 `MAKER` 改成任何别的 `tif`，只是在支持新值时追加分支。

### 2. 回读侧：tif + price -> order_type

Gate 的 `MARKET` 和 `IOC` 在 `tif` 层都可能表现为 `ioc`，不能只凭 `tif` 回填 `order_type`。当前 `submitOrder.ts` 的稳定行为为：

- `MARKET` 提交时 `price = '0'`
- `IOC` 提交时 `price` 为真实限价

因此回读规则采用 `tif + price` 联合判断：

- `tif = 'fok'` -> `FOK`
- `tif = 'ioc'` 且 `price` 为 `0` -> `MARKET`
- `tif = 'ioc'` 且 `price` 为正数 -> `IOC`
- `tif = 'gtc'` 且可识别为 maker 订单时，维持现有 `MAKER` / `LIMIT` 语义
- 无法识别时回退到当前最接近的现有行为，避免凭空引入新的推断逻辑

本次不会臆造额外 heuristics。若 Gate open order payload 中没有足够字段稳定区分 `LIMIT` 和 `MAKER`，则保持现有行为，只新增 `IOC/FOK` 的识别。

### 3. 测试策略

遵循 TDD，先写失败测试，再补最小实现：

- 纯映射测试：
  - `IOC -> ioc`
  - `FOK -> fok`
- 提交测试：
  - `submitOrder` 提交 `IOC/FOK` 时透传正确 `tif`
  - `IOC/FOK` 仍要求价格，不走 `MARKET` 的 `price='0'`
- 回读测试：
  - `tif='ioc', price='0' -> MARKET`
  - `tif='ioc', price='12345' -> IOC`
  - `tif='fok' -> FOK`

由于 `vendor-gate` 当前测试基础较少，本次优先增加纯函数测试和 `submitOrder/listOrders` 的最小集成测试，不引入更大的测试基建。

## 错误处理

- 若调用方传入未知 `order_type`，仍抛出 `Unsupported order_type`。
- 若回读时 `tif` 与 `price` 组合无法识别，则维持现有最接近行为，不进行激进猜测。

## 验证策略

- 针对新增测试执行红绿循环。
- 运行 `rush build -t @yuants/vendor-gate` 做仓库级验证。
- 若再次被 `@yuants/http-services` 既有失败阻塞，需要在结果中明确说明这是基线问题，不归因于 Gate IOC/FOK 改动。

## 提交策略

- 提交 1：测试与共享映射 helper。
- 提交 2：`submitOrder` 接入 IOC/FOK。
- 提交 3：`listOrders` 回填 `order_type`。
- 提交 4：`SESSION_NOTES`、`rush change`、验证与 PR 更新。

每个提交保持自洽，可单独审阅。
